const mongoose = require("mongoose");
const Document = require("./Document");

mongoose.connect("mongodb://localhost/google-docs")
  .then(() => {
    console.log("MongoDB connected successfully");
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
  });

const io = require("socket.io")(3001, {
    cors: {
        origin: "http://localhost:5175",
        methods: ["GET", "POST"],
    },
});

const defaultValue = "";

io.on("connection", (socket) => {
    console.log("User connected");

    socket.on("get-document", async (documentId) => {
        try {
            const document = await findOrCreateDocument(documentId);
            socket.join(documentId);
            socket.emit("load-document", document.data);

            socket.on("send-changes", (delta) => {
                socket.broadcast.to(documentId).emit("receive-changes", delta);
            });

            socket.on("save-document", async (data) => {
                await Document.findByIdAndUpdate(documentId, { data });
            });
        } catch (error) {
            console.error("Error handling document:", error);
        }
    });

    socket.on("disconnect", () => {
        console.log("User disconnected");
    });
});

async function findOrCreateDocument(id) {
    if (id == null) return;

    try {
        let document = await Document.findById(id);
        if (document) return document;
        document = await Document.create({ _id: id, data: defaultValue });
        return document;
    } catch (error) {
        console.error("Error finding or creating document:", error);
        throw error;
    }
}
