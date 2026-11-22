import * as React from "react"
import { createRoot } from "react-dom/client"
import AppointmentForm from "./AppointmentForm"
import "./site.css"

type IconName =
    | "doctor"
    | "care"
    | "support"
    | "phone"
    | "location"
    | "clock"
    | "email"
    | "website"
    | "arrow"

function Icon({ name }: { name: IconName }) {
    const shared = {
        fill: "none",
        stroke: "currentColor",
        strokeWidth: 1.7,
        strokeLinecap: "round" as const,
        strokeLinejoin: "round" as const,
    }

    let artwork: React.ReactNode

    switch (name) {
        case "doctor":
            artwork = (
                <>
                    <circle cx="12" cy="7" r="3.25" />
                    <path d="M5 21v-1.6a7 7 0 0 1 14 0V21" />
                    <path d="M19 4v5m-2.5-2.5h5" />
                </>
            )
            break
        case "care":
            artwork = (
                <>
                    <path d="M20.4 5.6a5.2 5.2 0 0 0-7.4 0L12 6.7l-1.1-1.1a5.2 5.2 0 0 0-7.4 7.4L12 21l8.4-8a5.2 5.2 0 0 0 0-7.4Z" />
                    <path d="M3.5 12h4l2-3.5 3.1 7 2-3.5h5.9" />
                </>
            )
            break
        case "support":
            artwork = (
                <>
                    <path d="M4 5.5h16v11H9l-5 3v-14Z" />
                    <path d="M8 10h8m-8 3h5" />
                    <path d="M17 3.5h4v3" />
                </>
            )
            break
        case "phone":
            artwork = (
                <path d="M7.1 3.5h2.7l1.4 4.1-2 1.7a15.4 15.4 0 0 0 5.5 5.5l1.7-2 4.1 1.4v2.7a2 2 0 0 1-2.2 2c-7.6-.7-13.6-6.7-14.3-14.3a2 2 0 0 1 2-2.2Z" />
            )
            break
        case "location":
            artwork = (
                <>
                    <path d="M19 10.1c0 5-7 11-7 11s-7-6-7-11a7 7 0 1 1 14 0Z" />
                    <circle cx="12" cy="10" r="2.3" />
                </>
            )
            break
        case "clock":
            artwork = (
                <>
                    <circle cx="12" cy="12" r="8.5" />
                    <path d="M12 7v5l3.5 2" />
                </>
            )
            break
        case "email":
            artwork = (
                <>
                    <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
                    <path d="m4.5 7 7.5 6 7.5-6" />
                </>
            )
            break
        case "website":
            artwork = (
                <>
                    <circle cx="12" cy="12" r="8.5" />
                    <path d="M3.8 12h16.4" />
                    <path d="M12 3.5c2.3 2.3 3.4 5.1 3.4 8.5s-1.1 6.2-3.4 8.5c-2.3-2.3-3.4-5.1-3.4-8.5s1.1-6.2 3.4-8.5Z" />
                </>
            )
            break
        case "arrow":
            artwork = <path d="M4.5 12h15m-6-6 6 6-6 6" />
            break
    }

    return (
        <svg
            aria-hidden="true"
            focusable="false"
            viewBox="0 0 24 24"
            {...shared}
        >
            {artwork}
        </svg>
    )
}

const clinicPhone = "9345293609"
const clinicPhoneHref = "tel:+919345293609"
const clinicAddress =
    "14, Arunachalam Road, Next to VB World, Saligramam, Chennai, Tamil Nadu – 600093"
const clinicMapHref =
    "https://www.google.com/maps/search/?api=1&query=14%2C%20Arunachalam%20Road%2C%20Next%20to%20VB%20World%2C%20Saligramam%2C%20Chennai%2C%20Tamil%20Nadu%20600093"
const clinicHours = "9:00 AM – 7:00 PM"
const clinicEmail = "accumedspecialityclinic@gmail.com"
const clinicWebsite = "https://www.ascasclinic.com/"

function App() {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false)
    const mobileMenuButtonRef = React.useRef<HTMLButtonElement>(null)
    const mobileDrawerRef = React.useRef<HTMLDivElement>(null)
    const shouldRestoreMenuFocus = React.useRef(true)

    React.useEffect(() => {
        if (!isMobileMenuOpen) return

        const previousBodyOverflow = document.body.style.overflow
        const previousDocumentOverflow =
            document.documentElement.style.overflow
        document.body.style.overflow = "hidden"
        document.documentElement.style.overflow = "hidden"

        mobileDrawerRef.current
            ?.querySelector<HTMLElement>("button, a[href]")
            ?.focus()

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                shouldRestoreMenuFocus.current = true
                setIsMobileMenuOpen(false)
                return
            }

            if (event.key !== "Tab" || !mobileDrawerRef.current) return

            const focusableElements = Array.from(
                mobileDrawerRef.current.querySelectorAll<HTMLElement>(
                    'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
                )
            )
            const firstElement = focusableElements[0]
            const lastElement = focusableElements[focusableElements.length - 1]

            if (!firstElement || !lastElement) {
                event.preventDefault()
                return
            }

            if (
                event.shiftKey &&
                (document.activeElement === firstElement ||
                    !mobileDrawerRef.current.contains(document.activeElement))
            ) {
                event.preventDefault()
                lastElement.focus()
            } else if (
                !event.shiftKey &&
                (document.activeElement === lastElement ||
                    !mobileDrawerRef.current.contains(document.activeElement))
            ) {
                event.preventDefault()
                firstElement.focus()
            }
        }

        const closeOnDesktopResize = () => {
            if (window.innerWidth > 600) {
                shouldRestoreMenuFocus.current = false
                setIsMobileMenuOpen(false)
            }
        }

        document.addEventListener("keydown", handleKeyDown)
        window.addEventListener("resize", closeOnDesktopResize)

        return () => {
            document.body.style.overflow = previousBodyOverflow
            document.documentElement.style.overflow =
                previousDocumentOverflow
            document.removeEventListener("keydown", handleKeyDown)
            window.removeEventListener("resize", closeOnDesktopResize)

            if (
                shouldRestoreMenuFocus.current &&
                mobileMenuButtonRef.current?.getClientRects().length
            ) {
                mobileMenuButtonRef.current.focus()
            }
        }
    }, [isMobileMenuOpen])

    function closeMobileMenu(restoreFocus = false) {
        shouldRestoreMenuFocus.current = restoreFocus
        setIsMobileMenuOpen(false)
    }

    return (
        <div className="site-shell" id="top">
            <header className="site-header">
                <a
                    className="brand-lockup"
                    href="#top"
                    aria-label="ASCAS — Personalised Care. A Healthier You."
                >
                    <img
                        className="brand-logo"
                        src="/ascas-logo.png"
                        alt=""
                        width="72"
                        height="72"
                    />
                    <span className="brand-copy">
                        <span className="brand-name">
                            ASCAS Fertility and Women&apos;s Center
                        </span>
                        <span className="brand-tagline">
                            PERSONALISED CARE. A HEALTHIER YOU.
                        </span>
                    </span>
                </a>

                <nav className="site-nav" aria-label="Main navigation">
                    <a href="#why-ascas">Our Services</a>
                    <a href="#contact">Contact</a>
                    <a className="nav-appointment" href="#appointment">
                        Book Appointment
                    </a>
                </nav>

                <button
                    ref={mobileMenuButtonRef}
                    className="mobile-menu-toggle"
                    type="button"
                    aria-label="Open navigation menu"
                    aria-expanded={isMobileMenuOpen}
                    aria-controls="mobile-navigation-drawer"
                    onClick={() => {
                        shouldRestoreMenuFocus.current = true
                        setIsMobileMenuOpen(true)
                    }}
                >
                    <svg
                        aria-hidden="true"
                        focusable="false"
                        viewBox="0 0 24 24"
                    >
                        <path d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                </button>
            </header>

            <main>
                <section className="hero-section" id="booking">
                    <div className="hero-grid">
                        <div className="hero-copy">
                            <p className="eyebrow">
                                GOOD HEALTH BEGINS WITH A CONVERSATION
                            </p>
                            <h1>Start Your Parenthood with ASCAS.</h1>
                            <p className="hero-lead">
                                Expert Medical Care Begins With a Conversation.
                            </p>
                            <p className="hero-description">
                                Take the first step towards your parenthood journey,
                                then schedule your consultation with our experienced
                                fertility specialist{" "}
                                <strong className="specialist-name">
                                    Dr. Aishwarya Parthasarathy
                                </strong>{" "}
                                and receive personalized guidance.
                            </p>

                            <aside className="offer-card" aria-labelledby="offer-title">
                                <div className="offer-topline">
                                    <span className="offer-mark" aria-hidden="true">
                                        <span />
                                        <span />
                                    </span>
                                    <p>A HEALTHIER START, ON US</p>
                                </div>
                                <h2 id="offer-title">
                                    YOUR FIRST CONSULTATION
                                    <span>IS FREE!</span>
                                </h2>
                                <p className="offer-description">
                                    Enjoy a complimentary consultation for your
                                    first visit. This offer applies to the first
                                    consultation only.
                                </p>
                                <p className="offer-signoff">
                                    Thoughtful guidance. Personalised attention.
                                    Care that starts with you.
                                </p>
                            </aside>

                            <a className="text-cta" href="#why-ascas">
                                Our services built for you.
                                <Icon name="arrow" />
                            </a>
                        </div>

                        <section
                            className="appointment-card"
                            id="appointment"
                            aria-labelledby="appointment-title"
                        >
                            <div className="appointment-card-heading">
                                <p className="eyebrow">WE’RE READY TO LISTEN</p>
                                <h2 id="appointment-title">
                                    Book Your Appointment
                                </h2>
                                <p>
                                    Fill in your details and our reception team
                                    will contact you.
                                </p>
                            </div>
                            <AppointmentForm />
                        </section>
                    </div>
                </section>

                <section
                    className="benefits-section content-section"
                    id="why-ascas"
                    aria-labelledby="benefits-title"
                >
                    <div className="section-heading">
                        <h2 id="benefits-title">Our Services Built for You</h2>
                    </div>

                    <div className="service-grid">
                        <article className="service-card">
                            <h3>Fertility &amp; Assisted Conception</h3>
                            <ul>
                                <li>IVF &amp; ICSI Treatment</li>
                                <li>Intrauterine Insemination (IUI)</li>
                                <li>Fertility Preservation &amp; Egg Freezing</li>
                                <li>Fertility-Enhancing Keyhole Surgeries</li>
                                <li>Male &amp; Female Infertility Workups</li>
                                <li>PCOS &amp; Fibroid Management</li>
                                <li>Advanced Embryology Services</li>
                                <li>Pre-Implantation Genetic Testing (PGT)</li>
                            </ul>
                        </article>

                        <article className="service-card">
                            <h3>Pregnancy &amp; Fetal Support</h3>
                            <ul>
                                <li>Targeted Anomaly Scan (TIFFA)</li>
                                <li>High-Risk Pregnancy Care</li>
                                <li>Govt-Recommended Fetal ECHO</li>
                                <li>CTG Fetal Heart Rate Monitoring</li>
                                <li>First Trimester Screening &amp; NIPT</li>
                                <li>Postnatal Care &amp; Lactation Support</li>
                            </ul>
                        </article>

                        <article className="service-card">
                            <h3>Surgical &amp; Advanced Diagnostics</h3>
                            <ul>
                                <li>Laparoscopic Gynecological Surgeries</li>
                                <li>4D Diagnostic Ultrasound &amp; Imaging</li>
                                <li>Day-Care Surgical Procedures</li>
                                <li>General &amp; Gastrointestinal Surgeries</li>
                            </ul>
                        </article>
                    </div>
                </section>

                <section
                    className="contact-section content-section"
                    id="contact"
                    aria-labelledby="contact-title"
                >
                    <div className="section-heading contact-heading">
                        <p className="eyebrow">HERE WHEN YOU NEED US</p>
                        <h2 id="contact-title">We’re here to help.</h2>
                    </div>

                    <div className="contact-grid">
                        <article className="contact-card">
                            <span className="icon-tile">
                                <Icon name="phone" />
                            </span>
                            <p className="contact-label">CALL OUR CARE TEAM</p>
                            <a className="contact-value" href={clinicPhoneHref}>
                                {clinicPhone}
                            </a>
                        </article>

                        <a
                            className="contact-card contact-card-link"
                            href={clinicMapHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Open ${clinicAddress} in Google Maps`}
                        >
                            <span className="icon-tile">
                                <Icon name="location" />
                            </span>
                            <p className="contact-label">VISIT OUR HOSPITAL</p>
                            <span className="contact-value map-address">
                                {clinicAddress}
                            </span>
                        </a>

                        <article className="contact-card">
                            <span className="icon-tile">
                                <Icon name="email" />
                            </span>
                            <p className="contact-label">EMAIL OUR TEAM</p>
                            <a
                                className="contact-value email-value"
                                href={`mailto:${clinicEmail}`}
                            >
                                {clinicEmail}
                            </a>
                        </article>

                        <article className="contact-card">
                            <span className="icon-tile">
                                <Icon name="clock" />
                            </span>
                            <p className="contact-label">WORKING HOURS</p>
                            <p className="contact-value">{clinicHours}</p>
                        </article>
                    </div>

                    <div className="contact-website">
                        <span className="icon-tile">
                            <Icon name="website" />
                        </span>
                        <div>
                            <p className="contact-extra-label">CLINIC WEBSITE</p>
                            <a
                                className="contact-extra-value"
                                href={clinicWebsite}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                {clinicWebsite}
                            </a>
                        </div>
                    </div>
                </section>
            </main>

            <footer className="site-footer">
                <div className="footer-inner">
                    <div className="footer-brand">
                        <a className="footer-wordmark" href="#top">
                            ASCAS Fertility and Women&apos;s Center
                        </a>
                        <p>PERSONALISED CARE. A HEALTHIER YOU.</p>
                    </div>
                    <p className="footer-credit">
                        Designed and developed by{" "}
                        <a
                            href="https://www.acutixsoft.com/"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            Acutix Soft LLP
                        </a>
                    </p>
                </div>
                <div className="footer-bottom">
                    <span>© 2026 ASCAS. All rights reserved.</span>
                    <a href="#top">Back to top ↑</a>
                </div>
            </footer>

            {isMobileMenuOpen && (
                <div
                    className="mobile-drawer-backdrop"
                    onClick={(event) => {
                        if (event.target === event.currentTarget) {
                            closeMobileMenu(true)
                        }
                    }}
                >
                    <div
                        ref={mobileDrawerRef}
                        className="mobile-navigation-drawer"
                        id="mobile-navigation-drawer"
                        role="dialog"
                        aria-modal="true"
                        aria-label="Mobile navigation"
                    >
                        <div className="mobile-drawer-heading">
                            <span>Navigation</span>
                            <button
                                className="mobile-drawer-close"
                                type="button"
                                aria-label="Close navigation menu"
                                onClick={() => closeMobileMenu(true)}
                            >
                                <svg
                                    aria-hidden="true"
                                    focusable="false"
                                    viewBox="0 0 24 24"
                                >
                                    <path d="m6 6 12 12M18 6 6 18" />
                                </svg>
                            </button>
                        </div>
                        <nav
                            className="mobile-drawer-links"
                            aria-label="Mobile main navigation"
                        >
                            <a
                                href="#why-ascas"
                                onClick={() => closeMobileMenu()}
                            >
                                Our Services
                            </a>
                            <a
                                href="#contact"
                                onClick={() => closeMobileMenu()}
                            >
                                Contact
                            </a>
                            <a
                                className="mobile-drawer-appointment"
                                href="#appointment"
                                onClick={() => closeMobileMenu()}
                            >
                                Book Appointment
                            </a>
                        </nav>
                    </div>
                </div>
            )}
        </div>
    )
}

const rootElement = document.getElementById("root")

if (!rootElement) {
    throw new Error("Could not find the application root element.")
}

createRoot(rootElement).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
)
