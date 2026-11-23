import * as React from "react"

export interface AppointmentFormProps {
    style?: React.CSSProperties
}

/** @framerSupportedLayoutWidth any */
/** @framerSupportedLayoutHeight auto */

export default function AppointmentForm({
    style,
}: AppointmentFormProps) {
    const [status, setStatus] = React.useState("")
    const [statusType, setStatusType] = React.useState<"error" | "success">(
        "error"
    )
    const [isSubmitting, setIsSubmitting] = React.useState(false)
    const [submitHover, setSubmitHover] = React.useState(false)
    const [country, setCountry] = React.useState("+91")
    const [narrow, setNarrow] = React.useState(false)
    const [submittedName, setSubmittedName] = React.useState("")
    const [dateValue, setDateValue] = React.useState("")
    const [openDropdown, setOpenDropdown] = React.useState<
        "consultation" | "branch" | null
    >(null)
    const ref = React.useRef<HTMLDivElement>(null)
    const formRef = React.useRef<HTMLFormElement>(null)
    const appointmentDateRef = React.useRef<HTMLInputElement>(null)
    const submissionLock = React.useRef(false)
    const idempotencyKey = React.useRef<string | null>(null)
    const dateDisplay = dateValue
        ? `${dateValue.slice(8, 10)}-${dateValue.slice(5, 7)}-${dateValue.slice(0, 4)}`
        : "DD-MM-YYYY"

    React.useEffect(() => {
        if (!ref.current) return

        const updateWidth = () => {
            setNarrow(ref.current!.getBoundingClientRect().width < 360)
        }

        updateWidth()

        if (typeof ResizeObserver === "undefined") {
            window.addEventListener("resize", updateWidth)
            return () => window.removeEventListener("resize", updateWidth)
        }

        const observer = new ResizeObserver((entries) => {
            setNarrow(entries[0].contentRect.width < 360)
        })

        observer.observe(ref.current)
        return () => observer.disconnect()
    }, [])

    const input: React.CSSProperties = {
        width: "100%",
        boxSizing: "border-box",
        border: "1px solid #E9D9D4",
        borderRadius: 11,
        padding: "15px 14px",
        background: "#FFFFFF",
        color: "#34252B",
        font: '400 15px "DM Sans", sans-serif',
        minWidth: 0,
        outline: "none",
        transition: "border-color 160ms ease, box-shadow 160ms ease, background 160ms ease",
        boxShadow: "0 1px 2px rgba(112, 45, 67, 0.03)",
    }

    const label: React.CSSProperties = {
        display: "flex",
        flexDirection: "column",
        gap: 9,
        fontSize: 13,
        fontWeight: 600,
        color: "#702D43",
    }

    function setFieldFocus(field: HTMLInputElement | HTMLSelectElement) {
        field.style.borderColor = "#702D43"
        field.style.boxShadow = "0 0 0 3px rgba(112, 45, 67, 0.12)"
    }

    function clearFieldFocus(field: HTMLInputElement | HTMLSelectElement) {
        field.style.borderColor = "#E9D9D4"
        field.style.boxShadow = "none"
    }

    function openDatePicker() {
        const dateInput = appointmentDateRef.current
        if (!dateInput) return
        if (typeof dateInput.showPicker === "function") {
            dateInput.showPicker()
        } else {
            dateInput.focus()
            dateInput.click()
        }
    }

    function showStatus(
        message: string,
        type: "error" | "success" = "error"
    ) {
        setStatus(message)
        setStatusType(type)
    }

    const today = new Date()
    const minimumDate =
        today.getFullYear() +
        "-" +
        String(today.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(today.getDate()).padStart(2, "0")

    async function submit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()

        if (submissionLock.current) return

        const form = e.currentTarget

        if (!form.reportValidity()) return
        setStatus("")

        const data = new FormData(form)
        const value = (key: string) => String(data.get(key) || "").trim()

        const mobile = value("mobile").replace(/[\s().-]/g, "")

        if (!value("fullName")) {
            showStatus("Please enter the patient's full name.")
            return
        }

        const mobileRules: Record<string, { pattern: RegExp; message: string }> = {
            "+91": {
                pattern: /^[6-9]\d{9}$/,
                message: "Please enter a valid 10-digit Indian mobile number.",
            },
            "+1": {
                pattern: /^\d{10}$/,
                message: "Please enter a valid 10-digit US/Canada mobile number.",
            },
            "+44": {
                pattern: /^\d{10,12}$/,
                message: "Please enter a valid UK mobile number.",
            },
            "+971": {
                pattern: /^\d{9}$/,
                message: "Please enter a valid 9-digit UAE mobile number.",
            },
        }

        const mobileRule = mobileRules[country]

        if (!mobileRule || !mobileRule.pattern.test(mobile)) {
            showStatus(
                mobileRule?.message || "Please enter a valid mobile number."
            )
            return
        }

        const appointmentDate = value("preferredDate")

        if (appointmentDate && appointmentDate < minimumDate) {
            showStatus("Please select today or a future appointment date.")
            return
        }

        if (!data.get("consent")) {
            showStatus("Please provide consent before continuing.")
            return
        }

        submissionLock.current = true
        setIsSubmitting(true)

        try {
            const requestKey =
                idempotencyKey.current || window.crypto.randomUUID()
            idempotencyKey.current = requestKey
            const response = await fetch("/api/appointments", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Idempotency-Key": requestKey,
                },
                body: JSON.stringify({
                    patientName: value("fullName"),
                    countryCode: country,
                    mobile,
                    consultationType: value("consultationType"),
                    clinic: value("clinic"),
                    appointmentDate,
                    consent: Boolean(data.get("consent")),
                }),
            })

            const result: { ok?: boolean; message?: string } =
                await response.json().catch(() => ({}))

            if (!response.ok || !result.ok) {
                throw new Error(
                    result.message ||
                        "We could not submit your request. Please try again or contact the clinic."
                )
            }

            setSubmittedName(value("fullName"))
            setStatus("")
        } catch (error) {
            showStatus(
                error instanceof Error
                    ? error.message
                    : "We could not submit your request. Please try again or contact the clinic directly.",
                "error"
            )
        } finally {
            submissionLock.current = false
            setIsSubmitting(false)
        }
    }

    function requestAnother() {
        formRef.current?.reset()
        setCountry("+91")
        setDateValue("")
        setStatus("")
        setStatusType("error")
        setSubmittedName("")
        idempotencyKey.current = null
    }

    if (submittedName) {
        return (
            <div
                ref={ref}
                style={{
                    ...style,
                    width: "100%",
                    fontFamily: '"DM Sans", sans-serif',
                }}
            >
                <section
                    role="status"
                    aria-live="polite"
                    style={{
                        minHeight: 420,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 16,
                        padding: narrow ? 24 : 38,
                        border: "1px solid #E9D9D4",
                        borderRadius: 18,
                        background: "#FFFFFF",
                        boxShadow: "0 14px 36px rgba(112, 45, 67, 0.08)",
                        textAlign: "center",
                    }}
                >
                    <div
                        aria-hidden="true"
                        style={{
                            width: 82,
                            height: 82,
                            display: "grid",
                            placeItems: "center",
                            borderRadius: "50%",
                            background: "#E7F6EC",
                            color: "#25844A",
                            fontSize: 46,
                            lineHeight: 1,
                        }}
                    >
                        ✓
                    </div>
                    <h3
                        style={{
                            margin: "4px 0 0",
                            color: "#542033",
                            fontSize: 28,
                            lineHeight: 1.2,
                        }}
                    >
                        Consultation Requested
                    </h3>
                    <p
                        style={{
                            maxWidth: 390,
                            margin: 0,
                            color: "#75666B",
                            fontSize: 15,
                            lineHeight: 1.7,
                        }}
                    >
                        Thank you, {submittedName}. Our care team will contact you shortly
                        to confirm your consultation.
                    </p>
                    <button
                        type="button"
                        onClick={requestAnother}
                        style={{
                            marginTop: 8,
                            border: 0,
                            borderRadius: 11,
                            padding: "15px 18px",
                            background: "#702D43",
                            color: "#FFFFFF",
                            font: '600 15px "DM Sans", sans-serif',
                            cursor: "pointer",
                            minHeight: 50,
                        }}
                    >
                        Request Another Consultation
                    </button>
                </section>
            </div>
        )
    }

    return (
        <div
            ref={ref}
            style={{
                ...style,
                width: "100%",
                fontFamily: '"DM Sans", sans-serif',
            }}
        >
            <form
                ref={formRef}
                className="appointment-form"
                onSubmit={submit}
                onChange={() => {
                    if (status) setStatus("")
                    if (!submissionLock.current) {
                        idempotencyKey.current = null
                    }
                }}
                style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 22,
                    padding: narrow ? 18 : 26,
                    border: "1px solid #E9D9D4",
                    borderRadius: 18,
                    background: "#FFFFFF",
                    boxShadow: "0 14px 36px rgba(112, 45, 67, 0.08)",
                }}
                aria-describedby={status ? "appointment-status" : undefined}
            >
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: narrow ? "1fr" : "1fr 1fr",
                        gap: narrow ? 16 : 18,
                    }}
                >
                    <label style={label}>
                        Patient Full Name *
                        <input
                            style={input}
                            name="fullName"
                            autoComplete="name"
                            placeholder="Enter your full name"
                            required
                            maxLength={100}
                            onFocus={(e) => setFieldFocus(e.currentTarget)}
                            onBlur={(e) => clearFieldFocus(e.currentTarget)}
                        />
                    </label>

                    <label style={label}>
                        Mobile Number *
                        <div style={{ display: "flex", gap: 5 }}>
                            <select
                                aria-label="Country code"
                                value={country}
                                onChange={(e) => setCountry(e.target.value)}
                                style={{
                                    ...input,
                                    width: 78,
                                    padding: "12px 5px",
                                }}
                                onFocus={(e) => setFieldFocus(e.currentTarget)}
                                onBlur={(e) => clearFieldFocus(e.currentTarget)}
                            >
                                <option value="+91">IN +91</option>
                                <option value="+1">US +1</option>
                                <option value="+44">UK +44</option>
                                <option value="+971">AE +971</option>
                            </select>

                            <input
                                aria-label="Mobile number"
                                style={{ ...input, flex: 1 }}
                                name="mobile"
                                type="tel"
                                inputMode="tel"
                                autoComplete="tel-national"
                                placeholder="Mobile number"
                                required
                                maxLength={20}
                                onFocus={(e) => setFieldFocus(e.currentTarget)}
                                onBlur={(e) => clearFieldFocus(e.currentTarget)}
                            />
                        </div>
                    </label>

                    <label style={label}>
                        Preferred Consultation
                        <div
                            className={`appointment-select-wrap${openDropdown === "consultation" ? " is-open" : ""}`}
                            style={{ position: "relative" }}
                        >
                            <select
                                name="consultationType"
                                style={{
                                    ...input,
                                    height: 50.67,
                                    appearance: "none",
                                    paddingRight: 40,
                                }}
                                defaultValue=""
                                onClick={() =>
                                    setOpenDropdown((current) =>
                                        current === "consultation"
                                            ? null
                                            : "consultation"
                                    )
                                }
                                onChange={() => setOpenDropdown(null)}
                                onKeyDown={(e) => {
                                    if (e.key === "Escape") setOpenDropdown(null)
                                }}
                                onFocus={(e) => setFieldFocus(e.currentTarget)}
                                onBlur={(e) => {
                                    clearFieldFocus(e.currentTarget)
                                    setOpenDropdown(null)
                                }}
                            >
                                <option value="" disabled>
                                    Select consultation
                                </option>
                                <option value="Fertility Consultation">
                                    Fertility Consultation
                                </option>
                                <option value="Gynaecologist Consultation">
                                    Gynaecologist Consultation
                                </option>
                                <option value="Pregnancy Consultation">
                                    Pregnancy Consultation
                                </option>
                            </select>
                            <svg
                                className="appointment-select-chevron"
                                aria-hidden="true"
                                viewBox="0 0 16 16"
                                style={{
                                    position: "absolute",
                                    right: 14,
                                    top: "50%",
                                    width: 14,
                                    height: 14,
                                    pointerEvents: "none",
                                    color: "#702D43",
                                }}
                            >
                                <path
                                    d="m3.5 6 4.5 4 4.5-4"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="1.5"
                                />
                            </svg>
                        </div>
                    </label>

                    <label style={label}>
                        Preferred Branch
                        <div
                            className={`appointment-select-wrap${openDropdown === "branch" ? " is-open" : ""}`}
                            style={{ position: "relative" }}
                        >
                            <select
                                name="clinic"
                                defaultValue=""
                                style={{
                                    ...input,
                                    appearance: "none",
                                    paddingRight: 40,
                                }}
                                onFocus={(e) => setFieldFocus(e.currentTarget)}
                                onClick={() =>
                                    setOpenDropdown((current) =>
                                        current === "branch" ? null : "branch"
                                    )
                                }
                                onChange={() => setOpenDropdown(null)}
                                onKeyDown={(e) => {
                                    if (e.key === "Escape") setOpenDropdown(null)
                                }}
                                onBlur={(e) => {
                                    clearFieldFocus(e.currentTarget)
                                    setOpenDropdown(null)
                                }}
                            >
                                <option value="" disabled>
                                    Select branch
                                </option>
                                <option value="Vadapalani">Vadapalani</option>
                                <option value="Valasaravakkam">
                                    Valasaravakkam
                                </option>
                            </select>
                            <svg
                                className="appointment-select-chevron"
                                aria-hidden="true"
                                viewBox="0 0 16 16"
                                style={{
                                    position: "absolute",
                                    right: 14,
                                    top: "50%",
                                    width: 14,
                                    height: 14,
                                    pointerEvents: "none",
                                    color: "#702D43",
                                }}
                            >
                                <path
                                    d="m3.5 6 4.5 4 4.5-4"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="1.5"
                                />
                            </svg>
                        </div>
                    </label>

                    <label style={label}>
                        Preferred Appointment Date
                        <div style={{ position: "relative" }}>
                            <input
                                ref={appointmentDateRef}
                                className="appointment-date-input"
                                type="date"
                                name="preferredDate"
                                min={minimumDate}
                                tabIndex={-1}
                                aria-hidden="true"
                                aria-readonly="true"
                                style={{
                                    ...input,
                                    height: 50.67,
                                    padding: "15px 40px 15px 14px",
                                    color: "transparent",
                                    WebkitTextFillColor: "transparent",
                                    pointerEvents: "none",
                                }}
                                onChange={(e) =>
                                    setDateValue(e.currentTarget.value)
                                }
                            />
                            <button
                                type="button"
                                className="appointment-date-picker-button"
                                aria-label={`Preferred Appointment Date: ${dateDisplay}. Open date picker`}
                                onClick={openDatePicker}
                            >
                                <span
                                    className={`appointment-date-display${dateValue ? " has-value" : ""}`}
                                    aria-hidden="true"
                                >
                                    {dateDisplay}
                                </span>
                                <svg
                                    aria-hidden="true"
                                    viewBox="0 0 20 20"
                                    width="17"
                                    height="17"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="1.5"
                                >
                                    <rect x="3" y="5" width="14" height="12" rx="2" />
                                    <path d="M6.5 3.5v3M13.5 3.5v3M3 8.5h14" />
                                </svg>
                            </button>
                        </div>
                    </label>
                </div>

                <label
                    style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 10,
                        fontSize: 12,
                        lineHeight: 1.6,
                        color: "#75666B",
                    }}
                >
                    <input
                        type="checkbox"
                        name="consent"
                        required
                        style={{
                            accentColor: "#702D43",
                            width: 18,
                            height: 18,
                            flexShrink: 0,
                            marginTop: 1,
                            cursor: "pointer",
                        }}
                    />
                    I agree to share these appointment details with the clinic
                    through its WhatsApp notification provider so they can
                    contact me about my request.
                </label>

                <button
                    type="submit"
                    disabled={isSubmitting}
                    onMouseEnter={() => setSubmitHover(true)}
                    onMouseLeave={() => setSubmitHover(false)}
                    style={{
                        border: 0,
                        borderRadius: 11,
                        padding: "17px 16px",
                        background: "#702D43",
                        color: "#FFFFFF",
                        font: '600 16px "DM Sans", sans-serif',
                        cursor: isSubmitting ? "wait" : "pointer",
                        opacity: isSubmitting ? 0.75 : 1,
                        minHeight: 52,
                        boxShadow: submitHover && !isSubmitting
                            ? "0 10px 22px rgba(112, 45, 67, 0.20)"
                            : "0 4px 12px rgba(112, 45, 67, 0.12)",
                        transform: submitHover && !isSubmitting
                            ? "translateY(-1px)"
                            : "none",
                        transition: "opacity 150ms ease, transform 150ms ease, box-shadow 150ms ease",
                    }}
                >
                    {isSubmitting
                        ? "Sending request..."
                        : "Submit Appointment Request"}
                </button>

                {status && (
                    <p
                        id="appointment-status"
                        role={statusType === "error" ? "alert" : "status"}
                        aria-live={statusType === "error" ? "assertive" : "polite"}
                        style={{
                            margin: 0,
                            fontSize: 14,
                            lineHeight: 1.5,
                            color: "#702D43",
                            background: "#FBECEF",
                            padding: 14,
                            borderRadius: 8,
                            border: "1px solid #E9D9D4",
                        }}
                    >
                        {status}
                    </p>
                )}

                <p
                    style={{
                        fontSize: 11,
                        lineHeight: 1.65,
                        color: "#75666B",
                        margin: 0,
                    }}
                >
                    Your appointment details will be sent securely to the
                    clinic for follow-up. Your appointment remains pending
                    until the clinic confirms it.
                </p>
            </form>
        </div>
    )
}

