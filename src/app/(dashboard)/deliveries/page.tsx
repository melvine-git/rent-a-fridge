import { redirect } from 'next/navigation';

// Dispatch used to live at /deliveries; keep old links and bookmarks working
export default function DeliveriesPage() {
  redirect('/dispatch');
}
