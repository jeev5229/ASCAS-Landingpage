# Appointment Booking

This project serves the React/Vite appointment form and a same-origin Node.js
API. Appointment notifications are sent from the API to the configured clinic
receptionist through AiSensy; browser code never receives the AiSensy key or
receptionist number.

## Configure AiSensy

1. Copy `.env.example` to `.env`.
2. Set these server-side values in `.env`:
   - `AISENSY_API_KEY`: the API key from the AiSensy account.
   - `AISENSY_CAMPAIGN_NAME`: the exact name of the approved AiSensy campaign.
   - `RECEPTIONIST_WHATSAPP_NUMBER`: receptionist destination in international
     format, digits only (for example, country code followed by the number).
3. Keep `.env` private. It is ignored by Git. Do not prefix these values with
   `VITE_`.

The approved campaign template should use this copy, replacing the bracketed
values with exactly four body parameters:

```text
NEW APPOINTMENT REQUEST

A patient has requested an appointment.

Patient Name: {{1}}

Mobile Number: {{2}}

Preferred Clinic / Centre: {{3}}

Requested Appointment Date: {{4}}

Status: Patient Requested Appointment - Pending Clinic Confirmation.

Please contact the patient to confirm the appointment.
```

The four body parameters must remain in this order:

1. Patient name
2. Patient mobile number, including country code
3. Preferred clinic / centre
4. Requested appointment date

Branch and appointment date are optional in the form. When either is omitted,
the API sends `Not specified` for that parameter so the approved four-parameter
template never receives an empty or misleading value. The consultation type is
also optional and remains part of the appointment submission, but is not
included in the approved WhatsApp template parameters.

AiSensy/Meta must approve the template before it can be used. The campaign name
and parameter order must match that approved template. An API acceptance means
AiSensy accepted the notification request; it does not mean the message was
delivered or that the appointment was confirmed.

## Public landing-page details

The landing page uses the supplied clinic phone, address, email, website and
working hours. The phone, email, address and website links open their respective
phone, email, Google Maps and website destinations. Privacy and terms links are
configurable through `VITE_PRIVACY_POLICY_URL` and `VITE_TERMS_URL`. These
`VITE_` values are public and are included in browser assets; until configured,
the page displays placeholders rather than inventing policy URLs.

`PORT` defaults to `3001`. `CLINIC_TIME_ZONE` defaults to `Asia/Kolkata` and
controls server-side validation of the requested appointment date.

## Run locally

Use Node.js 22.12 or newer:

```powershell
npm install
npm run dev
```

Open the Vite URL printed in the terminal. The development command starts both
the frontend and API. For production, build and start the same-origin server:

```powershell
npm run build
npm start
```

The production server serves `dist` and `/api/appointments` from the same
origin. Configure the environment variables in the hosting provider's private
server environment; do not deploy `.env`.

## Verify without sending WhatsApp messages

```powershell
npm test
npm run typecheck
npm run build
```

The API tests stub the AiSensy request and do not send real messages.
