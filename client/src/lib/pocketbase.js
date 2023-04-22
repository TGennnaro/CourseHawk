import PocketBase from 'pocketbase';

const pb = new PocketBase("https://coursehawk-pocketbase.fly.dev");
pb.admins.authWithPassword(import.meta.env.VITE_PB_EMAIL, import.meta.env.VITE_PB_PASSWORD)
	.catch(err => console.log(err));

export default pb;