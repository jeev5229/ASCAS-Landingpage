import { spawn } from "node:child_process"

const children = [
    spawn(
        process.execPath,
        [
            "--env-file-if-exists=.env",
            "server.mjs",
        ],
        { stdio: "inherit" }
    ),
    spawn(
        process.execPath,
        ["node_modules/vite/bin/vite.js"],
        { stdio: "inherit" }
    ),
]

let stopping = false

function stopChildren() {
    if (stopping) return
    stopping = true
    for (const child of children) {
        if (child.exitCode === null) child.kill()
    }
}

for (const child of children) {
    child.on("error", (error) => {
        console.error("Could not start the development process:", error.message)
        stopChildren()
        process.exitCode = 1
    })
    child.on("exit", (code) => {
        if (!stopping && code !== 0) {
            process.exitCode = code || 1
            stopChildren()
        }
    })
}

process.on("SIGINT", stopChildren)
process.on("SIGTERM", stopChildren)
