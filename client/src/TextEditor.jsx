
import { useCallback, useEffect, useState } from "react"
import Quill from "quill"
import "quill/dist/quill.snow.css"
import { io } from "socket.io-client"
import { useParams } from "react-router-dom"

const SAVE_INTERVAL_MS = 2000
const TOOLBAR_OPTIONS = [
  [{ header: [1, 2, 3, 4, 5, 6, false] }], // Header options
  [{ font: [] }], // Font options
  [{ list: "ordered" }, { list: "bullet" }], // List options
  ["bold", "italic", "underline"], // Text formatting options
  [{ color: [] }, { background: [] }], // Color options
  [{ script: "sub" }, { script: "super" }], // Script options
  [{ align: [] }], // Align options
  ["image", "blockquote", "code-block"], // Insert options
  ["clean"], // Clean formatting button
]

export default function TextEditor() {
  const { id: documentId } = useParams()
  const [socket, setSocket] = useState()
  const [quill, setQuill] = useState()

  // Initialize socket connection
  useEffect(() => {
    const s = io("http://localhost:3001")
    setSocket(s)

    return () => {
      s.disconnect()
    }
  }, [])

  // Initialize Quill editor when the wrapper is set
  const wrapperRef = useCallback(wrapper => {
    if (wrapper == null) return

    wrapper.innerHTML = ""
    const editor = document.createElement("div")
    wrapper.append(editor)

    // Initialize Quill editor
    const q = new Quill(editor, {
      theme: "snow",
      modules: { toolbar: TOOLBAR_OPTIONS },
    })

    q.disable() // Disable editing until the document is loaded
    q.setText("Loading...")
    setQuill(q)
  }, [])

  // Load document when the socket is connected and the quill instance is set
  useEffect(() => {
    if (socket == null || quill == null) return

    socket.once("load-document", document => {
      quill.setContents(document)  // Set the loaded document content
      quill.enable()                // Enable the editor
    })

    socket.emit("get-document", documentId)  // Request the document
  }, [socket, quill, documentId])

  // Periodic save operation to keep document data synced
  useEffect(() => {
    if (socket == null || quill == null) return

    const interval = setInterval(() => {
      socket.emit("save-document", quill.getContents())
    }, SAVE_INTERVAL_MS)

    return () => {
      clearInterval(interval)  // Clean up interval on unmount
    }
  }, [socket, quill])

  // Sync real-time changes from other users
  useEffect(() => {
    if (socket == null || quill == null) return

    const handler = delta => {
      quill.updateContents(delta)  // Apply changes received from other users
    }

    socket.on("receive-changes", handler)

    return () => {
      socket.off("receive-changes", handler)  // Clean up listener on unmount
    }
  }, [socket, quill])

  // Send user edits to other clients
  useEffect(() => {
    if (socket == null || quill == null) return

    const handler = (delta, oldDelta, source) => {
      if (source !== "user") return
      socket.emit("send-changes", delta)  // Broadcast changes to other clients
    }

    quill.on("text-change", handler)

    return () => {
      quill.off("text-change", handler)  // Clean up listener on unmount
    }
  }, [socket, quill])

  return <div className="container" ref={wrapperRef}></div>
}
