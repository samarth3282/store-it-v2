import React from 'react';
import ClientPage from './ClientPage';

export function generateStaticParams() {
  return [
    { type: 'documents' },
    { type: 'images' },
    { type: 'media' },
    { type: 'others' },
  ];
}

export default function Page() {
  return <ClientPage />;
}

