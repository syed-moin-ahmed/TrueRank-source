import { LuCompass, LuHouse } from "react-icons/lu";
import { Button, EmptyState } from "../../components/ui.jsx";

export default function NotFound() {
  return (
    <section className="section">
      <div className="container">
        <EmptyState icon={LuCompass} title="Page not found" action={<Button variant="primary" icon={LuHouse} to="/">Back to home</Button>}>
          The page you are looking for does not exist or has moved.
        </EmptyState>
      </div>
    </section>
  );
}
