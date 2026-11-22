import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { afterEach, test } from "node:test"
import { createAppServer } from "./server.mjs"

const openServers = new Set()
const validAppointment = {
    patientName: "Asha Patient",
    countryCode: "+91",
    mobile: "9876543210",
    consultationType: "Fertility Consultation",
    clinic: "Vadapalani",
    appointmentDate: futureDate(),
    consent: true,
}

function futureDate() {
    const date = new Date()
    date.setDate(date.getDate() + 2)
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0"),
    ].join("-")
}

async function startServer({
    env = configuredEnv(),
    fetchImpl = async () => Response.json({ success: true }),
    logger = console,
    rateLimitMax,
} = {}) {
    const server = createAppServer({ env, fetchImpl, logger, rateLimitMax })
    openServers.add(server)
    await new Promise((resolve, reject) => {
        server.once("error", reject)
        server.listen(0, "127.0.0.1", resolve)
    })
    const { port } = server.address()

    return {
        post(body = validAppointment, idempotencyKey = randomUUID()) {
            return fetch(`http://127.0.0.1:${port}/api/appointments`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Idempotency-Key": idempotencyKey,
                },
                body: JSON.stringify(body),
            })
        },
    }
}

function configuredEnv(overrides = {}) {
    return {
        AISENSY_API_KEY: "test-key-not-a-real-credential",
        AISENSY_CAMPAIGN_NAME: "approved_appointment_template",
        RECEPTIONIST_WHATSAPP_NUMBER: "919999888877",
        CLINIC_TIME_ZONE: "Asia/Kolkata",
        ...overrides,
    }
}

afterEach(async () => {
    await Promise.all(
        [...openServers].map(
            (server) =>
                new Promise((resolve) => {
                    server.close(resolve)
                    openServers.delete(server)
                })
        )
    )
})

test("valid request sends template data to the configured receptionist", async () => {
    let payload
    const app = await startServer({
        fetchImpl: async (url, options) => {
            assert.equal(
                url,
                "https://backend.aisensy.com/campaign/t1/api/v2"
            )
            payload = JSON.parse(options.body)
            return Response.json({ success: true })
        },
    })

    const response = await app.post()
    const result = await response.json()

    assert.equal(response.status, 200)
    assert.equal(result.ok, true)
    assert.equal(payload.destination, "919999888877")
    assert.notEqual(payload.destination, "919876543210")
    assert.deepEqual(payload.templateParams, [
        "Asha Patient",
        "+91 9876543210",
        "Vadapalani",
        validAppointment.appointmentDate,
    ])
    assert.equal(payload.templateParams.length, 4)
    assert.equal(payload.userName, validAppointment.patientName)
    assert.equal(payload.campaignName, "approved_appointment_template")
    assert.equal(payload.apiKey, "test-key-not-a-real-credential")
})

test("invalid mobile numbers are rejected before contacting AiSensy", async () => {
    let called = false
    const app = await startServer({
        fetchImpl: async () => {
            called = true
            return Response.json({ success: true })
        },
    })

    const response = await app.post({ ...validAppointment, mobile: "123" })
    assert.equal(response.status, 400)
    assert.equal(called, false)
})

test("missing required fields are rejected", async () => {
    const app = await startServer()
    const response = await app.post({
        ...validAppointment,
        patientName: "",
        consent: false,
    })
    assert.equal(response.status, 400)
})

test("consultation type remains required in the backend appointment submission", async () => {
    let called = false
    const app = await startServer({
        fetchImpl: async () => {
            called = true
            return Response.json({ success: true })
        },
    })

    const response = await app.post({
        ...validAppointment,
        consultationType: "",
    })
    assert.equal(response.status, 400)
    assert.equal(called, false)
})

test("missing receptionist number is reported without contacting AiSensy", async () => {
    let called = false
    const app = await startServer({
        env: configuredEnv({ RECEPTIONIST_WHATSAPP_NUMBER: "" }),
        fetchImpl: async () => {
            called = true
            return Response.json({ success: true })
        },
    })

    const response = await app.post()
    const result = await response.json()
    assert.equal(response.status, 503)
    assert.match(result.message, /notification number is not configured/i)
    assert.equal(called, false)
})

test("missing AiSensy credentials do not trigger a provider call", async () => {
    let called = false
    const app = await startServer({
        env: configuredEnv({ AISENSY_API_KEY: "" }),
        fetchImpl: async () => {
            called = true
            return Response.json({ success: true })
        },
    })

    const response = await app.post()
    assert.equal(response.status, 503)
    assert.equal(called, false)
})

test("AiSensy campaign rejection is returned as a safe error", async () => {
    const app = await startServer({
        fetchImpl: async () =>
            Response.json(
                { status: "error", message: "private provider details" },
                { status: 400 }
            ),
    })

    const response = await app.post()
    const result = await response.json()
    assert.equal(response.status, 502)
    assert.doesNotMatch(JSON.stringify(result), /private provider details/)
})

test("AiSensy rejection diagnostics include safe codes but redact patient and secret data", async () => {
    const logs = []
    const app = await startServer({
        env: configuredEnv({ WHATSAPP_API_TOKEN: "test-secondary-secret" }),
        logger: {
            error: (...args) => logs.push(args),
        },
        fetchImpl: async () =>
            Response.json(
                {
                    status: "error",
                    code: "INVALID_TEMPLATE",
                    message:
                        "Template rejected for Asha Patient, 9876543210, 919999888877, test-key-not-a-real-credential; campaign not active",
                },
                { status: 400 }
            ),
    })

    await app.post()
    const diagnosticLog = JSON.stringify(logs)

    assert.match(diagnosticLog, /INVALID_TEMPLATE/)
    assert.match(diagnosticLog, /campaign not active/)
    assert.match(diagnosticLog, /400/)
    assert.doesNotMatch(diagnosticLog, /Asha Patient/)
    assert.doesNotMatch(diagnosticLog, /9876543210/)
    assert.doesNotMatch(diagnosticLog, /919999888877/)
    assert.doesNotMatch(diagnosticLog, /test-key-not-a-real-credential/)
    assert.doesNotMatch(diagnosticLog, /test-secondary-secret/)
})

test("AiSensy server failures do not expose provider response details", async () => {
    const app = await startServer({
        fetchImpl: async () =>
            Response.json(
                { message: "private provider details" },
                { status: 500 }
            ),
    })

    const response = await app.post()
    const result = await response.json()
    assert.equal(response.status, 502)
    assert.doesNotMatch(JSON.stringify(result), /private provider details/)
})

test("duplicate idempotency keys result in only one provider request", async () => {
    let providerCalls = 0
    const app = await startServer({
        fetchImpl: async () => {
            providerCalls += 1
            await new Promise((resolve) => setTimeout(resolve, 20))
            return Response.json({ success: true })
        },
    })
    const key = randomUUID()

    const [first, second] = await Promise.all([
        app.post(validAppointment, key),
        app.post(validAppointment, key),
    ])

    assert.equal(first.status, 200)
    assert.equal(second.status, 200)
    assert.equal(providerCalls, 1)
})

test("rate limit blocks excess submissions", async () => {
    const app = await startServer({ rateLimitMax: 1 })
    const first = await app.post()
    const second = await app.post()
    assert.equal(first.status, 200)
    assert.equal(second.status, 429)
})
