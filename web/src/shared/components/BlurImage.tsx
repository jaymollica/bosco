import { useState } from 'react'

interface Props {
  src: string
  alt: string
  blur?: string
  style?: React.CSSProperties
}

export default function BlurImage({ src, alt, blur, style }: Props) {
  const [loaded, setLoaded] = useState(false)

  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: blur ? `url(${blur}) center/cover no-repeat` : '#eee',
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
          objectFit: 'cover',
          opacity: loaded ? 1 : 0,
          transition: 'opacity 0.4s ease',
        }}
      />
    </div>
  )
}
