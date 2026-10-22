import { redirect } from 'next/navigation';

// The website lives in /public/index.html (served by Next.js). Its forms call the /api routes.
export default function Home() {
  redirect('/index.html');
}
