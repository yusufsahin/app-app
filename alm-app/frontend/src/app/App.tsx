import { RouterProvider } from "react-router-dom";
import { router } from "./router";

export function App() {
  return (
    <div className="min-h-svh w-full">
      <RouterProvider router={router} />
    </div>
  );
}
