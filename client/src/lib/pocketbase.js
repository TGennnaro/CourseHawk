import PocketBase from 'pocketbase';

const pb = new PocketBase("https://coursehawk-pocketbase.fly.dev");
await pb.admins.authWithPassword(import.meta.env.VITE_PB_EMAIL, import.meta.env.VITE_PB_PASSWORD);

export default pb;