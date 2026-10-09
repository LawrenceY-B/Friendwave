import { Router } from "express";
import { requiresAuth } from "express-openid-connect";
import { Login, Logout } from "../controllers/auth";

const Authroutes = Router();

Authroutes.get('/login', requiresAuth(), Login)
Authroutes.get('/logout', Logout)

export default Authroutes
