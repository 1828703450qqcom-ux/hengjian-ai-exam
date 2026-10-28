export default function PortalArt({ variant = 'teacher' }) {
  const purple = variant === 'student'
  return <svg className="portal-art" viewBox="0 0 200 200" fill="none" role="img" aria-label={purple ? '能力成长矢量插图' : '智慧教学矢量插图'}>
    <circle cx="100" cy="100" r="77" stroke="#D9F5FF" strokeOpacity=".48" strokeWidth="1.5" strokeDasharray="4 8" />
    <circle cx="100" cy="100" r="56" stroke="#D9F5FF" strokeOpacity=".35" />
    <ellipse cx="100" cy="100" rx="85" ry="31" transform="rotate(-23 100 100)" stroke="#A6E6FF" strokeOpacity=".7" strokeWidth="2" />
    <path d="m100 43 55 32v50l-55 32-55-32V75l55-32Z" fill={purple ? '#B98CFF' : '#7ED7FF'} fillOpacity=".2" stroke="#E5FBFF" strokeOpacity=".8" strokeWidth="2" />
    <path d={purple ? 'm100 73 30 12-30 11-30-11 30-12Zm-23 19v19c8 12 38 12 46 0V92' : 'M76 76h49v48H76zM85 87h31M85 98h31M85 109h20'} fill="#FFFFFF22" stroke="#F4FFFF" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
    <circle cx="42" cy="62" r="4" fill="#D6F8FF" /><circle cx="160" cy="142" r="5" fill="#D6F8FF" />
    <path d="M34 112h13M153 47h16M100 15v14M99 170v15" stroke="#D6F8FF" strokeWidth="2" strokeLinecap="round" />
  </svg>
}
