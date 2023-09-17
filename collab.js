import express from "express";
import expressWebsockets from "express-ws";
import { Server } from "@hocuspocus/server";
import * as Y from "yjs";
import axios from "axios";
import { fromUint8Array, toUint8Array } from "js-base64";

const server = Server.configure({
  name: "hocuspocus-fra1-01",
  port: 1239,
  onStoreDocument,
  onLoadDocument,
  timeout: 30000,
  debounce: 5000,
  maxDebounce: 30000,
  quiet: true,
  async onAuthenticate(data) {
    const { token } = data;
    // Example test if a user is authenticated with a token passed from the client
    console.log(token);
    if (token !== "super") {
      throw new Error("Not authorized!");
    }

    // You can set contextual data to use it in other hooks
    return {
      user: {
        id: 1234,
        name: "John",
      },
    };
  },
  beforeHandleMessage(data) {
    // console.log("data", data.context);
  },
});

server.listen();

// Setup your express instance using the express-ws extension
const { app } = expressWebsockets(express());

// Add a websocket route for Hocuspocus
// Note: make sure to include a parameter for the document name.
// You can set any contextual data like in the onConnect hook
// and pass it to the handleConnection method.
app.ws("/document/:docId", (websocket, request) => {
  console.log(request.params.docId);
  const context = {
    user: {
      id: 1234,
      name: "Jane",
    },
  };
  server.handleConnection(websocket, request, context);
});

// Start the server
app.listen(1237, () => console.log("Listening on http://127.0.0.1:1237"));

async function onStoreDocument(incomingData) {
  const { documentName, document } = incomingData;
  if (!documentName) return Promise.resolve();
  const state = Y.encodeStateAsUpdate(document);
  const dbDocument = fromUint8Array(state);
  return await axios.post("http://localhost:3333/doc/update", {
    docId: documentName,
    text: dbDocument,
  });
}

async function onLoadDocument(incomingData) {
  const { documentName, document } = incomingData;
  if (!documentName) return Promise.resolve();
  const documentFromDB = (
    await axios.get(`http://localhost:3333/doc/single/${documentName}`)
  ).data;
  console.log("docfromdb", documentFromDB);
  if (documentFromDB && documentFromDB.text) {
    const dbDocument = toUint8Array(documentFromDB.text || "");
    if (dbDocument) Y.applyUpdate(document, dbDocument);
    return document;
  }
  return document;
}
