import { mongodbAdapter } from "better-auth/adapters/mongodb";
import {
    twoFactor,
    username,
    anonymous,
    phoneNumber,
    apiKey,
    admin,
    organization,
    oidcProvider,
    bearer,
    multiSession,
    jwt,
} from "better-auth/plugins";
import { betterAuth } from "better-auth";
import { db } from "../../database/mongo-connection";
import { sendEmail } from "./helpers/email";
import { env } from "../../configs/env";

export const auth = betterAuth({
    database: mongodbAdapter(db),
    appName: "auth-auth",
    trustedOrigins: [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost:8000",
    ],
    emailVerification:{
        enabled: true,
        sendVerificationEmail: async ( { user, url, token }, request) => {
            // console.log(`Verification link for user ${user.email}: ${url} , token: ${token}`);
            await sendEmail({
                to: user.email,
                subject: "Verify your email address",
                text: `Click the link to verify your email: ${url}.
                If you did not initiate an attempt to create a GatheredAI account or validate your email, please ignore this email.`,
            });
        },
    },
    emailAndPassword: { 
        enabled: true, 
        sendResetPassword: async ({user, url, token}, request) => {
            // console.log(`Password reset link for user ${user.email}: ${url} , token: ${token}`);
            await sendEmail({
                to: user.email,
                subject: "Reset your password",
                text: `Click the link to reset your password: ${env.AUTH_SERVER_RELATED_CLIENT}/auth/reset-password?token=${token}\n
                If you did not initiate an attempt to reset your password, please ignore this email.`,
            });
        },
        onPasswordReset: async ({ user }, request) => {
            // your logic here
            console.log(`Password for user ${user.email} has been reset.`);
           
        },
    }, 
    plugins: [
        jwt(), 
        multiSession(),
        bearer(),
        organization(),
        admin(),
        apiKey(),
        phoneNumber(),
        anonymous(),
        username(),
        twoFactor(),
    ],
});
