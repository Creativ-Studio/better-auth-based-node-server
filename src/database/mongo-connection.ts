import { MongoClient } from "mongodb";

import { env } from "../configs/env";

const client = new MongoClient(
    env.AUTH_SERVER_MONGO_URI,
);
const db = client.db();

export { db };