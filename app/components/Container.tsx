import { PropsWithChildren } from "react";

export default function Container({ children }: PropsWithChildren) {
  return <main className="container">{children}</main>;
}
