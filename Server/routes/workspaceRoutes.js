import express from "express";
import { 
    getUserWorkspaces, 
    addMemberToWorkspace
} from "../controllers/workspaceController.js";

const workspaceRouter = express.Router();

// Workspace routes
workspaceRouter.get("/", getUserWorkspaces);
workspaceRouter.post("/add-member", addMemberToWorkspace);

export default workspaceRouter;