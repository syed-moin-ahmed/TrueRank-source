// Blue "verified" tick shown next to the founder's name.
import { MdVerified } from "react-icons/md";

export default function VerifiedTick({ size = 22, className = "" }) {
  return (
    <span className={`verified-tick ${className}`} title="Verified" aria-label="Verified" role="img">
      <MdVerified style={{ width: size, height: size }} aria-hidden="true" />
    </span>
  );
}
