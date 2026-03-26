import { RouterProvider } from "react-router-dom";
import { router } from "./router";

export function App() {
  return (
    <div className="flex min-h-svh">
      <RouterProvider router={router} />
    </div>
  );
}
