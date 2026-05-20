import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Logo } from "@/components/Logo";
import { RWANDA_DISTRICTS } from "@/lib/mock-data";
import { toast } from "sonner";
import { listDistrictsApi, type ApiDistrict } from "@/lib/nvms-api";
import { useEffect, useMemo } from "react";
import { limitRwandaPhoneInput, validateBirthDate, validateRwandaPhone } from "@/lib/validation";

function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    district: "",
    password: "",
    dateOfBirth: "",
    contactPreference: "both" as "email" | "sms" | "both",
  });
  const [districts, setDistricts] = useState<ApiDistrict[] | null>(null);
  const maxBirthDate = new Date();
  maxBirthDate.setFullYear(maxBirthDate.getFullYear() - 18);
  const maxBirthDateValue = maxBirthDate.toISOString().slice(0, 10);

  useEffect(() => {
    listDistrictsApi().then((r) => {
      if (!r.ok) return;
      setDistricts(r.data);
    });
  }, []);

  const districtOptions = useMemo(() => {
    return RWANDA_DISTRICTS.map((name) => {
      const apiDistrict = districts?.find((d) => d.name === name);
      return { value: apiDistrict?.id ?? name, label: name, districtId: apiDistrict?.id };
    });
  }, [districts]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const dobCheck = validateBirthDate(form.dateOfBirth);
    if (!dobCheck.ok) {
      toast.error(dobCheck.error);
      return;
    }
    const phoneCheck = validateRwandaPhone(form.phone);
    if (!phoneCheck.ok) {
      toast.error(phoneCheck.error);
      return;
    }
    const selectedDistrict = districtOptions.find((d) => d.value === form.district);
    if (!selectedDistrict) {
      toast.error("Please select your district.");
      return;
    }
    try {
      await register({
        name: form.name,
        email: form.email,
        district: selectedDistrict?.districtId ? undefined : selectedDistrict?.label,
        districtId: selectedDistrict?.districtId,
        phone: phoneCheck.value,
        password: form.password,
        contactPreference: form.contactPreference,
        dateOfBirth: dobCheck.value,
      });
      toast.success("Registration received", {
        description:
          "A coordinator will review your district registration. Sign in here after approval using your email and password, then complete identity verification (KYC) to apply to programs.",
      });
      navigate("/login");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Registration failed");
    }
  };

  return (
    <div className="flex min-h-screen">
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="mb-8"><Logo /></div>
          <h1 className="font-display text-3xl font-bold">Register as a volunteer</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Join the national volunteer network. After a district coordinator approves your registration, sign in with your email and password, complete trusted identity (ID, photo, skills), and wait for KYC approval before you can apply to programs.
          </p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <div>
              <Label htmlFor="name">Full name</Label>
              <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                placeholder="078XXXXXXX or +2507XXXXXXXX"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: limitRwandaPhoneInput(e.target.value) })}
                maxLength={13}
                required
              />
            </div>
            <div>
              <Label htmlFor="district">District</Label>
              <Select required value={form.district} onValueChange={(v) => setForm({ ...form, district: v })}>
                <SelectTrigger id="district"><SelectValue placeholder="Select your district" /></SelectTrigger>
                <SelectContent>
                  {districtOptions.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="dob">Date of birth</Label>
              <Input id="dob" type="date" max={maxBirthDateValue} value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} required />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} />
            </div>
            <div>
              <Label htmlFor="notify">Approval notifications</Label>
              <Select value={form.contactPreference} onValueChange={(v) => setForm({ ...form, contactPreference: v as "email" | "sms" | "both" })}>
                <SelectTrigger id="notify"><SelectValue placeholder="How should we notify you?" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email (smartphone / webmail)</SelectItem>
                  <SelectItem value="sms">SMS (basic phone / no smartphone)</SelectItem>
                  <SelectItem value="both">Both email and SMS</SelectItem>
                </SelectContent>
              </Select>
              <p className="mt-1.5 text-xs text-muted-foreground">Used when a coordinator approves or rejects your registration (requires backend messaging).</p>
            </div>
            <Button type="submit" className="w-full">Create account</Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account? <Link to="/login" className="font-medium text-primary hover:underline">Sign in</Link>
          </div>
        </div>
      </div>

      <div className="hidden flex-1 flex-col justify-between bg-gradient-hero p-10 text-white lg:flex">
        <div />
        <div>
          <h2 className="font-display text-4xl font-bold leading-tight">Serve Rwanda.<br/>Build your community.</h2>
          <p className="mt-4 max-w-md text-white/80">Every volunteer profile contributes to a national network that supports education, health, environment and emergency response programs across the country.</p>
        </div>
        <p className="text-xs text-white/60">Your data is secure and governed by the Ministry of Local Government.</p>
      </div>
    </div>
  );
}

export default RegisterPage;
