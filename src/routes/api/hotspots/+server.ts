import { json } from '@sveltejs/kit';
import fs from 'node:fs';
import path from 'node:path';

export async function POST({ request }) {
	try {
		const data = await request.json();
		const filePath = path.resolve('src/lib/hotspots.json');
		fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
		return json({ success: true });
	} catch (error: any) {
		return json({ success: false, error: error.message }, { status: 500 });
	}
}
