# Royal Service Center

<p align="center">
  <strong>A modern, real-time vehicle service management platform</strong>
</p>

<p align="center">
  <a href="https://royalservice.tech"><img src="https://img.shields.io/badge/Live%20Demo-royalservice.tech-0f172a?style=for-the-badge&logo=vercel&logoColor=white" alt="Live demo"></a>
  <img src="https://img.shields.io/badge/Stack-MERN-16a34a?style=for-the-badge" alt="MERN stack">
  <img src="https://img.shields.io/badge/Real--time-Socket.io-010101?style=for-the-badge&logo=socket.io&logoColor=white" alt="Socket.io">
  <img src="https://img.shields.io/badge/Styling-Tailwind%20CSS-06b6d4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind CSS">
</p>

Royal Service Center is a final-year university project designed to streamline vehicle servicing from appointment booking through service completion. The platform connects customers, service staff, and administrators through role-specific dashboards, real-time communication, secure authentication, and digital service records.

## ✨ Features

- 🚗 **Real-time service slot allocation** — Manage vehicle service appointments and availability efficiently.
- 👥 **Role-based dashboards** — Dedicated experiences for **Customers**, **Staff**, and **Administrators**.
- 💳 **Stripe payment integration** — Support secure online service payments.
- 🔐 **OTP authentication** — Add an additional verification step to the authentication flow.
- 📄 **Automated PDF service history** — Generate downloadable service records for completed work.
- 💬 **Support Center live chat** — A Socket.io-powered chat widget built from scratch.
- ⚡ **Optimistic chat UI** — Render outgoing messages immediately for a responsive experience.
- 🔔 **WhatsApp-style unread divider** — Clearly separate unread messages, with a five-second delayed read receipt.
- 📝 **Typing indicators and smooth auto-scrolling** — Keep conversations natural and easy to follow.
- 🤖 **Quick-reply bot commands** — Provide fast answers to common support questions.
- 🛡️ **Strict chat access control** — Restrict support conversations and staff tools according to user roles.

## 🧰 Technology Stack

| Layer | Technologies |
| --- | --- |
| Frontend | React, Vite, Tailwind CSS, Axios, React Router |
| Backend | Node.js, Express |
| Database | MongoDB with Mongoose |
| Real-time communication | Socket.io |
| Authentication | OTP verification and token-based authentication |
| Payments and documents | Stripe integration and PDFKit |
| Hosting | Vercel with the custom domain [royalservice.tech](https://royalservice.tech) |

The custom domain and hosting setup are secured and supported through the **GitHub Student Developer Pack**.

## 🗂️ Project Structure

```text
Royal Service Center/
├── client/                 # React frontend
│   ├── public/
│   └── src/
├── server/                 # Express backend and Socket.io server
│   ├── configs/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   └── server.js
└── README.md
```

## ✅ Prerequisites

Install the following before starting:

- [Node.js](https://nodejs.org/) 18 or later
- npm
- A running [MongoDB](https://www.mongodb.com/) instance or MongoDB Atlas database
- Git

You will also need credentials for the services enabled in your local environment, such as OTP email delivery, Stripe, and cloud storage where applicable.

## 🚀 Local Installation

### 1. Clone the repository

```bash
git clone https://github.com/DeshanNethsara/royalservice.git
cd royalservice
```

### 2. Configure and run the backend

```bash
cd server
npm install
```

Create a `server/.env` file and add the environment values required by your local setup. Keep secrets out of source control.

Start the backend in development mode:

```bash
npm run dev
```

To run the backend without file watching:

```bash
npm start
```

### 3. Configure and run the frontend

Open a second terminal from the project root:

```bash
cd client
npm install
```

Create a `client/.env` file with the frontend API and Socket.io endpoint required by your environment, then start Vite:

```bash
npm run dev
```

The frontend will be available at the local URL printed by Vite. The production build can be generated with:

```bash
npm run build
```

## 🔒 Security and Environment Variables

- Never commit `.env` files, API keys, database credentials, JWT secrets, Stripe secrets, OTP provider credentials, or cloud-storage credentials.
- Use separate development and production values for all environment variables.
- Only expose values that are explicitly intended for the browser through the frontend environment configuration.
- Configure CORS, authentication secrets, payment credentials, and Socket.io origins for the deployed domains.
- Treat all client input as untrusted and enforce authorization on the server for every protected route and chat event.
- Rotate credentials immediately if they are accidentally exposed.

## 🌐 Deployment

The frontend is deployed on **Vercel** and is available at:

**[https://royalservice.tech](https://royalservice.tech)**

For a production deployment, configure the frontend API URL, backend URL, Socket.io origin, database connection, authentication, payment, and email-related environment variables in the hosting provider rather than committing them to the repository.

## 🎓 Academic Project

Royal Service Center was developed as a final-year university project to demonstrate practical full-stack engineering, real-time web communication, secure role-based workflows, and the digitization of vehicle service-center operations.

## 📄 License

This project is maintained for academic and demonstration purposes. Add an appropriate open-source license before redistributing it publicly.
