import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Mark } from '../db/types'
import { AnnotatedImage } from './annotated'

/** Print em tela cheia, com as marcações; fecha com Esc ou clique em qualquer lugar. */
export function Lightbox({ image, marks, alt, onClose }: { image: Blob | undefined; marks?: Mark[]; alt: string; onClose: () => void }) {
  const [aspect, setAspect] = useState(16 / 9)

  useEffect(() => {
    if (!image) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [image, onClose])

  return createPortal(
    <AnimatePresence>
      {image && (
        <motion.div
          className="fixed inset-0 z-[150] grid cursor-zoom-out place-items-center bg-[#03070a]/92 p-8 backdrop-blur"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.94 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 400, damping: 34 }}
            style={{ width: `min(92vw, calc(88vh * ${aspect}))` }}
          >
            <AnnotatedImage image={image} marks={marks} pulse alt={alt} onAspect={setAspect} className="w-full overflow-hidden rounded-xl shadow-2xl" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
