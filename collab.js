import express from "express";
import expressWebsockets from "express-ws";
import { Server } from "@hocuspocus/server";
import * as Y from "yjs";
import axios from "axios";
import "dotenv/config";

import { fromUint8Array, toUint8Array } from "js-base64";
const server = Server.configure({
  name: process.env.HOCUS_POCUS_SERVER_NAME,
  port: 1239,
  onStoreDocument,
  onLoadDocument,
  timeout: 30000,
  debounce: 5000,
  maxDebounce: 30000,
  quiet: true,
  async onAuthenticate(data) {
    const { token } = data;
    if (token !== process.env.SECRET) {
      throw new Error("Not authorized!");
    }
  },
});

server.listen();

const { app } = expressWebsockets(express());

app.ws("/document/:docId", (websocket, request) => {
  console.log(request.params.docId);
  server.handleConnection(websocket, request);
});

app.listen(1237, () => console.log("Listening on port 1237"));

async function onStoreDocument(incomingData) {
  const { documentName, document } = incomingData;
  if (!documentName) return Promise.resolve();
  const state = Y.encodeStateAsUpdate(document);
  const dbDocument = fromUint8Array(state);
  return await axios.post(`${process.env.BACKEND_URL}/doc/update`, {
    docId: documentName,
    text: dbDocument,
  });
}

async function onLoadDocument(incomingData) {
  const { documentName, document } = incomingData;
  if (!documentName) return Promise.resolve();
  const documentFromDB = (
    await axios.get(`${process.env.BACKEND_URL}/doc/single/${documentName}`)
  ).data;
  if (documentFromDB && documentFromDB.text) {
    const dbDocument = toUint8Array(documentFromDB.text || "");
    if (dbDocument) Y.applyUpdate(document, dbDocument);
    return document;
  }
  return document;
}
