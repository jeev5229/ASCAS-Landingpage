import { createHash } from "node:crypto"
import { createServer as createHttpServer } from "node:http"
import { readFile, stat } from "node:fs/promises"
import { extname, resolve, sep } from "node:path"
import { fileURLToPath } from "node:url"
import doctors from "./doctors.json" with { type: "json" }

const AISENSY_ENDPOINT = "https://backend.aisensy.com/campaign/t1/api/v2"
const DOCTORS = new Set(doctors.map(({ value }) => value))
const CLINICS = new Set(["Vadapalani", "Valasaravakkam"])
const COUNTRY_RULES = {
    "+91": /^[6-9]\d{9}$/,
    "+1": /^\d{10}$/,
    "+44": /^\d{10,12}$/,
    "+971": /^\d{9}$/,
}
const MAX_BODY_BYTES = 8 * 1024
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000
const RATE_LIMIT_MAX_REQUESTS = 10
const IDEMPOTENCY_WINDOW_MS = 10 * 60 * 1000
const MAX_IDEMPOTENCY_ENTRIES = 1000

function jsonResponse(response, status, body, headers = {}) {
    response.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        ...headers,
    })
    response.end(JSON.stringify(body))
}

function localDateInZone(date, timeZone) {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(date)
    const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
    return `${values.year}-${values.month}-${values.day}`
}

function validateAppointment(input, now, timeZone) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
        return { error: "Please check your appointment details and try again." }
    }

    const patientName =
        typeof input.patientName === "string"
            ? input.patientName.trim().replace(/\s+/g, " ")
            : ""
    const countryCode = input.countryCode
    const rawMobile =
        typeof input.mobile === "string" ? input.mobile.trim() : ""
    const mobile = rawMobile.replace(/[\s().-]/g, "")
    const consultationType =
        typeof input.consultationType === "string"
            ? input.consultationType.trim()
            : input.consultationType === undefined || input.consultationType === null
              ? ""
              : null
    const clinic =
        typeof input.clinic === "string"
            ? input.clinic.trim()
            : input.clinic === undefined || input.clinic === null
              ? ""
              : null
    const appointmentDate =
        typeof input.appointmentDate === "string"
            ? input.appointmentDate.trim()
            : input.appointmentDate === undefined || input.appointmentDate === null
              ? ""
              : null

    if (
        consultationType === null ||
        clinic === null ||
        appointmentDate === null
    ) {
        return { error: "Please check your appointment details and try again." }
    }

    if (
        patientName.length < 2 ||
        patientName.length > 100 ||
        !/^[\p{L}\p{M}][\p{L}\p{M}\s.'’-]*$/u.test(patientName)
    ) {
        return { error: "Please enter a valid patient name." }
    }

    const mobilePattern = COUNTRY_RULES[countryCode]
    if (
        !mobilePattern ||
        !/^[\d\s().-]+$/.test(rawMobile) ||
        !mobilePattern.test(mobile)
    ) {
        return { error: "Please enter a valid mobile number for the selected country." }
    }

    if (consultationType && !DOCTORS.has(consultationType)) {
        return { error: "Please select a valid doctor." }
    }

    if (clinic && !CLINICS.has(clinic)) {
        return { error: "Please select a valid branch." }
    }

    if (appointmentDate) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate)) {
            return { error: "Please select a valid appointment date." }
        }

        const parsedDate = new Date(`${appointmentDate}T00:00:00.000Z`)
        if (
            Number.isNaN(parsedDate.getTime()) ||
            parsedDate.toISOString().slice(0, 10) !== appointmentDate ||
            appointmentDate < localDateInZone(now, timeZone)
        ) {
            return { error: "Please select today or a future appointment date." }
        }
    }

    if (input.consent !== true) {
        return { error: "Please provide consent before continuing." }
    }

    return {
        appointment: {
            patientName,
            countryCode,
            mobile,
            consultationType,
            clinic,
            appointmentDate,
        },
    }
}

async function readJsonBody(request) {
    const contentType = request.headers["content-type"] || ""
    if (!contentType.toLowerCase().startsWith("application/json")) {
        return { error: "Expected a JSON request." }
    }

    const chunks = []
    let bytes = 0
    for await (const chunk of request) {
        bytes += chunk.length
        if (bytes > MAX_BODY_BYTES) {
            return { tooLarge: true }
        }
        chunks.push(chunk)
    }

    try {
        return { body: JSON.parse(Buffer.concat(chunks).toString("utf8")) }
    } catch {
        return { error: "Please submit valid appointment details." }
    }
}

function normalizedPhone(value) {
    if (typeof value !== "string") return ""
    const digits = value.trim().replace(/[\s().-]/g, "").replace(/^\+/, "")
    return /^[1-9]\d{7,14}$/.test(digits) ? digits : ""
}

function buildCampaignPayload(appointment, config) {
    return {
        apiKey: config.apiKey,
        campaignName: config.campaignName,
        destination: config.receptionistNumber,
        userName: appointment.patientName,
        templateParams: [
            appointment.patientName,
            `${appointment.countryCode} ${appointment.mobile}`,
            appointment.clinic || "Not specified",
            appointment.appointmentDate || "Not specified",
        ],
        source: "appointment-form",
        media: {},
        buttons: [],
        carouselCards: [],
        location: {},
    }
}

function redactProviderText(value, sensitiveValues) {
    if (typeof value !== "string") return ""

    let safeText = value.replace(/[\r\n\t]+/g, " ")
    for (const sensitiveValue of sensitiveValues
        .filter((item) => typeof item === "string" && item.length > 1)
        .sort((left, right) => right.length - left.length)) {
        safeText = safeText.replace(
            new RegExp(
                sensitiveValue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
                "gi"
            ),
            "[redacted]"
        )
    }

    return safeText
        .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[redacted-email]")
        .replace(/\+?\d(?:[\s().-]*\d){7,14}/g, "[redacted-number]")
        .replace(/(api[_ -]?key|token|secret)\s*[:=]\s*\S+/gi, "$1=[redacted]")
        .slice(0, 300)
}

function logAiSensyRejection(
    logger,
    providerResponse,
    providerResult,
    responseText,
    appointment,
    config
) {
    const sensitiveValues = [
        config.apiKey,
        config.additionalToken,
        config.receptionistNumber,
        appointment.patientName,
        appointment.mobile,
        `${appointment.countryCode} ${appointment.mobile}`,
        appointment.consultationType,
        appointment.clinic,
        appointment.appointmentDate,
    ]
    const providerError =
        providerResult?.error && typeof providerResult.error === "object"
            ? providerResult.error
            : null
    const code =
        providerResult?.errorCode ??
        providerResult?.error_code ??
        providerError?.code ??
        providerResult?.code
    const message =
        providerResult?.message ??
        providerResult?.error_description ??
        providerError?.message ??
        (typeof providerResult?.error === "string"
            ? providerResult.error
            : responseText)

    logger.error("[AiSensy] appointment notification rejected", {
        httpStatus: providerResponse.status,
        providerStatus: redactProviderText(
            String(providerResult?.status ?? ""),
            sensitiveValues
        ),
        providerCode: redactProviderText(String(code ?? ""), sensitiveValues),
        providerMessage: redactProviderText(String(message ?? ""), sensitiveValues),
    })
}

async function sendToAiSensy(appointment, env, fetchImpl, logger) {
    const apiKey = env.AISENSY_API_KEY?.trim()
    const campaignName = env.AISENSY_CAMPAIGN_NAME?.trim()
    const receptionistNumber = normalizedPhone(
        env.RECEPTIONIST_WHATSAPP_NUMBER
    )

    if (!receptionistNumber) {
        return {
            status: 503,
            body: {
                ok: false,
                message:
                    "The clinic's WhatsApp notification number is not configured. Please contact the clinic directly.",
            },
        }
    }

    if (
        !apiKey ||
        apiKey.length > 500 ||
        !campaignName ||
        campaignName.length > 100 ||
        /[\r\n]/.test(campaignName)
    ) {
        return {
            status: 503,
            body: {
                ok: false,
                message:
                    "Appointment notifications are temporarily unavailable. Please contact the clinic directly.",
            },
        }
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)
    const config = {
        apiKey,
        additionalToken: env.WHATSAPP_API_TOKEN,
        campaignName,
        receptionistNumber,
    }

    try {
        const providerResponse = await fetchImpl(AISENSY_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(buildCampaignPayload(appointment, config)),
            signal: controller.signal,
        })

        const responseText = await providerResponse.text()
        let providerResult = null
        try {
            providerResult = JSON.parse(responseText)
        } catch {
            providerResult = null
        }

        const providerRejected =
            providerResult?.success === false ||
            ["error", "failed", "rejected"].includes(
                String(providerResult?.status || "").toLowerCase()
            )

        if (!providerResponse.ok || providerRejected) {
            logAiSensyRejection(
                logger,
                providerResponse,
                providerResult,
                responseText,
                appointment,
                config
            )
            return {
                status: 502,
                body: {
                    ok: false,
                    message:
                        "The clinic could not be notified right now. Please try again or contact the clinic.",
                },
            }
        }

        return {
            status: 200,
            body: {
                ok: true,
                message:
                    "AiSensy accepted the notification request. Your appointment is pending clinic confirmation.",
            },
        }
    } catch (error) {
        logger.error("[AiSensy] appointment notification request failed", {
            errorName:
                error instanceof Error ? error.name.slice(0, 80) : "UnknownError",
            networkCode: /^[A-Z0-9_-]{1,40}$/.test(error?.cause?.code || "")
                ? error.cause.code
                : undefined,
            timedOut: controller.signal.aborted,
        })
        return {
            status: 502,
            body: {
                ok: false,
                message:
                    "The clinic could not be notified right now. Please try again or contact the clinic.",
            },
        }
    } finally {
        clearTimeout(timeout)
    }
}

async function serveStatic(request, response, staticRoot) {
    const url = new URL(request.url, "http://localhost")
    let pathname
    try {
        pathname = decodeURIComponent(url.pathname)
    } catch {
        response.writeHead(400).end()
        return
    }

    const requestedPath = pathname === "/" ? "/index.html" : pathname
    const filePath = resolve(staticRoot, `.${requestedPath}`)
    if (filePath !== staticRoot && !filePath.startsWith(staticRoot + sep)) {
        response.writeHead(403).end()
        return
    }

    try {
        const fileInfo = await stat(filePath)
        if (!fileInfo.isFile()) {
            response.writeHead(404).end()
            return
        }
        const contentTypes = {
            ".css": "text/css; charset=utf-8",
            ".html": "text/html; charset=utf-8",
            ".ico": "image/x-icon",
            ".js": "text/javascript; charset=utf-8",
            ".png": "image/png",
            ".svg": "image/svg+xml",
        }
        response.writeHead(200, {
            "Content-Type":
                contentTypes[extname(filePath)] || "application/octet-stream",
            "X-Content-Type-Options": "nosniff",
        })
        response.end(await readFile(filePath))
    } catch {
        response.writeHead(404).end()
    }
}

export function createAppServer({
    env = process.env,
    fetchImpl = fetch,
    logger = console,
    staticRoot = resolve("dist"),
    now = () => Date.now(),
    rateLimitMax = RATE_LIMIT_MAX_REQUESTS,
} = {}) {
    const rateLimits = new Map()
    const idempotency = new Map()

    return createHttpServer(async (request, response) => {
        const requestUrl = new URL(request.url, "http://localhost")

        if (request.method === "GET" && requestUrl.pathname === "/api/health") {
            jsonResponse(response, 200, { ok: true })
            return
        }

        if (
            request.method !== "POST" ||
            requestUrl.pathname !== "/api/appointments"
        ) {
            if (request.method === "GET" && !requestUrl.pathname.startsWith("/api/")) {
                await serveStatic(request, response, staticRoot)
            } else {
                jsonResponse(response, 404, {
                    ok: false,
                    message: "Not found.",
                })
            }
            return
        }

        const currentTime = now()
        const clientIp = request.socket.remoteAddress || "unknown"
        const limit = rateLimits.get(clientIp)
        if (!limit || limit.expiresAt <= currentTime) {
            rateLimits.set(clientIp, {
                count: 1,
                expiresAt: currentTime + RATE_LIMIT_WINDOW_MS,
            })
        } else if (limit.count >= rateLimitMax) {
            jsonResponse(
                response,
                429,
                {
                    ok: false,
                    message:
                        "Too many appointment requests. Please wait a few minutes or contact the clinic.",
                },
                {
                    "Retry-After": String(
                        Math.max(1, Math.ceil((limit.expiresAt - currentTime) / 1000))
                    ),
                }
            )
            return
        } else {
            limit.count += 1
        }

        const parsed = await readJsonBody(request)
        if (parsed.tooLarge) {
            jsonResponse(response, 413, {
                ok: false,
                message: "The submitted appointment details are too large.",
            })
            return
        }
        if (parsed.error) {
            jsonResponse(response, 400, { ok: false, message: parsed.error })
            return
        }

        const validation = validateAppointment(
            parsed.body,
            new Date(currentTime),
            env.CLINIC_TIME_ZONE || "Asia/Kolkata"
        )
        if (validation.error) {
            jsonResponse(response, 400, {
                ok: false,
                message: validation.error,
            })
            return
        }

        const idempotencyKey = request.headers["idempotency-key"]
        if (
            typeof idempotencyKey !== "string" ||
            !/^[A-Za-z0-9-]{16,128}$/.test(idempotencyKey)
        ) {
            jsonResponse(response, 400, {
                ok: false,
                message: "Please retry submitting the appointment request.",
            })
            return
        }

        for (const [key, entry] of idempotency) {
            if (entry.expiresAt <= currentTime) idempotency.delete(key)
        }

        const cacheKey = `${clientIp}:${idempotencyKey}`
        const payloadHash = createHash("sha256")
            .update(JSON.stringify(validation.appointment))
            .digest("hex")
        const previous = idempotency.get(cacheKey)

        if (previous) {
            if (previous.payloadHash !== payloadHash) {
                jsonResponse(response, 409, {
                    ok: false,
                    message:
                        "This request key was already used for different appointment details. Please refresh and try again.",
                })
                return
            }
            const result = await previous.promise
            jsonResponse(response, result.status, result.body)
            return
        }

        const resultPromise = sendToAiSensy(
            validation.appointment,
            env,
            fetchImpl,
            logger
        )
        idempotency.set(cacheKey, {
            payloadHash,
            promise: resultPromise,
            expiresAt: currentTime + IDEMPOTENCY_WINDOW_MS,
        })
        while (idempotency.size > MAX_IDEMPOTENCY_ENTRIES) {
            idempotency.delete(idempotency.keys().next().value)
        }

        const result = await resultPromise
        if (result.status !== 200) idempotency.delete(cacheKey)
        jsonResponse(response, result.status, result.body)
    })
}

const isMain =
    process.argv[1] &&
    fileURLToPath(import.meta.url) === resolve(process.argv[1])

if (isMain) {
    const port = Number(process.env.PORT || 3001)
    const server = createAppServer()
    server.on("error", (error) => {
        if (error.code === "EADDRINUSE") {
            console.error(
                `Appointment API port ${port} is already in use. Stop the other server or set a different PORT in .env.`
            )
        } else {
            console.error("Could not start the appointment API:", error.message)
        }
        process.exitCode = 1
    })
    server.listen(port, "0.0.0.0", () => {
        console.log(`Appointment API listening on port ${port}`)
    })
}
