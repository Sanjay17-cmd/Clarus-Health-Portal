/** 3D Card component */
export default function Card({ children, className = '', flat = false, ...props }) {
  return (
    <div className={`${flat ? 'card-flat' : 'card'} ${className}`} {...props}>
      {children}
    </div>
  )
}
