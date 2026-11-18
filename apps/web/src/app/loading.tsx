// Shown instantly while any route segment loads.
import { Loader } from "./loader";

export default function Loading() {
  return <Loader label="Loading…" page />;
}
