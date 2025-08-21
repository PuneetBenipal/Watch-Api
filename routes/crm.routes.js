const express = require("express");
const Router = express.Router();
const authenticateToken = require("../middleware/auth");

const multer = require("multer");
const {
    listContacts,
    getContact,
    createContact,
    updateContact,
    deleteContact,
    importContacts,
    exportContacts,
} = require("../controllers/crm.ctrl.js");

const upload = multer({ storage: multer.memoryStorage() });


Router.get("/contacts", authenticateToken, listContacts);
Router.get("/contacts/export", authenticateToken, exportContacts);
Router.get("/contacts/:id", authenticateToken, getContact);

Router.post("/contacts", authenticateToken, createContact);
Router.patch("/contacts/:id", authenticateToken, updateContact);
Router.delete("/contacts/:id", authenticateToken, deleteContact);

Router.post(
    "/contacts/import",
    authenticateToken,
    upload.single("file"),
    importContacts
);

module.exports = Router;
