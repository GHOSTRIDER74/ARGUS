import { motion, useSpring } from "framer-motion";
import { type MouseEvent, type ReactNode, useRef } from "react";

interface Props {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  id?: string;
  distance?: number;
}

/**
 * MagneticButton — Follows cursor position within a radius on hover,
 * springing back smoothly on leave.
 */
export default function MagneticButton({
  children,
  className = "",
  onClick,
  id,
  distance = 0.35,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  const springConfig = { damping: 15, stiffness: 150, mass: 0.1 };
  const x = useSpring(0, springConfig);
  const y = useSpring(0, springConfig);

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const { left, top, width, height } = ref.current.getBoundingClientRect();
    const centerX = left + width / 2;
    const centerY = top + height / 2;

    const deltaX = (e.clientX - centerX) * distance;
    const deltaY = (e.clientY - centerY) * distance;

    x.set(deltaX);
    y.set(deltaY);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ x, y }}
      className="inline-block"
      onClick={onClick}
      id={id}
    >
      <motion.div
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        className={className}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}
