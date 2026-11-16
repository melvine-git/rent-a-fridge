import { redirect } from 'next/navigation';

// Collections are handled on Dispatch; keep old links and bookmarks working
export default function CollectionsPage() {
  redirect('/deliveries');
}
