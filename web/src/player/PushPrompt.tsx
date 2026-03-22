import { useEffect, useState } from 'react'
import { subscribeToPush, isPushSubscribed } from '../lib/pushSubscription.js'

const DISMISSED_KEY = 'bosco-push-dismissed'

export default function PushPrompt() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    // Don't show if not supported, already subscribed, denied, or recently dismissed
    if (!('PushManager' in window) || Notification.permission === 'denied') return

    const dismissed = localStorage.getItem(DISMISSED_KEY)
    if (dismissed && Date.now() - Number(dismissed) < 30 * 24 * 60 * 60 * 1000) return

    isPushSubscribed().then(subscribed => {
      if (!subscribed) setShow(true)
    }).catch(() => {})
  }, [])

  const handleSubscribe = async () => {
    try {
      await subscribeToPush()
    } catch {
      // permission denied or error
    }
    setShow(false)
  }

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()))
    setShow(false)
  }

  if (!show) return null

  return (
    <div style={{
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '0.75rem',
      padding: '1rem 1.25rem',
      background: 'rgba(255,255,255,0.1)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      fontFamily: 'system-ui, sans-serif',
      zIndex: 50,
    }}>
      <span style={{ fontSize: '0.8125rem', color: 'rgba(255,255,255,0.8)' }}>
        Get notified when new tours are published
      </span>
      <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
        <button
          onClick={handleDismiss}
          style={{
            padding: '0.4rem 0.75rem',
            fontSize: '0.75rem',
            background: 'none',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '4px',
            color: 'rgba(255,255,255,0.5)',
            cursor: 'pointer',
          }}
        >
          Later
        </button>
        <button
          onClick={handleSubscribe}
          style={{
            padding: '0.4rem 0.75rem',
            fontSize: '0.75rem',
            background: '#863bff',
            border: 'none',
            borderRadius: '4px',
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          Notify me
        </button>
      </div>
    </div>
  )
}
