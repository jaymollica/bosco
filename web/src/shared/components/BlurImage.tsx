import { useState } from 'react'

interface Props {
  src: string
  alt: string
  blur?: string
  style?: React.CSSProperties
  objectFit?: 'cover' | 'contain'
}

export default function BlurImage({ src, alt, blur, style, objectFit = 'cover' }: Props) {
  const [loaded, setLoaded] = useState(false)

  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: blur ? `url(${blur}) center/${objectFit} no-repeat` : '#eee',
        ...style,
      }}
    >
      <img
        src={src}
        alt={alt}
        onLoad={() => setLoaded(true)}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          objectFit,
          opacity: loaded ? 1 : 0,
          transition: 'opacity 0.4s ease',
        }}
      />
    </div>
  )
}
