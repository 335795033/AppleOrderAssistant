import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: '三丈apple助手',
    description: '三丈apple助手 (捡漏抢购增强版)',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body className={''}>{children}</body>
        </html>
    )
}
