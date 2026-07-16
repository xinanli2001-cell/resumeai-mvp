import { connection } from "next/server";
import { env } from "@/lib/config/env";
import { RegisterForm } from "./register-form";

export default async function RegisterPage() {
  await connection();
  return <RegisterForm registrationMode={env().REGISTRATION_MODE} />;
}
