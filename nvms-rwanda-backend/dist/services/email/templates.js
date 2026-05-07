function render(text, vars) {
    return text.replace(/\{\{(\w+)\}\}/g, (_m, key) => vars[key] ?? "");
}
export function getTemplate(templateId) {
    if (templateId === "coordinator_invite") {
        return {
            subject: "NVMS Rwanda — Coordinator invitation",
            text: [
                "Hello {{name}},",
                "",
                "You have been invited as a District Coordinator on the National Volunteer Management System (NVMS Rwanda).",
                "",
                "Login credentials (temporary):",
                "- Email: {{email}}",
                "- Password: {{password}}",
                "",
                "Login link: {{link}}",
                "",
                "Security warning:",
                "You must change this password immediately after your first login. Do not share credentials.",
                "",
                "Role: {{role}}",
                "District: {{district}}",
                "",
                "— MINALOC (Republic of Rwanda)",
            ].join("\n"),
        };
    }
    if (templateId === "volunteer_approved") {
        return {
            subject: "NVMS Rwanda — Registration approved",
            text: [
                "Hello {{name}},",
                "",
                "Your volunteer registration has been approved.",
                "You can now log in using your email and password.",
                "",
                "Login link: {{link}}",
                "",
                "Role: {{role}}",
                "",
                "— NVMS Rwanda",
            ].join("\n"),
        };
    }
    if (templateId === "volunteer_registration_received") {
        return {
            subject: "NVMS Rwanda — Registration received",
            text: [
                "Hello {{name}},",
                "",
                "Your volunteer registration has been received for district {{district}}.",
                "A coordinator will review your registration and notify you when approved.",
                "",
                "Login link: {{link}}",
                "",
                "Role: {{role}}",
                "",
                "— NVMS Rwanda",
            ].join("\n"),
        };
    }
    return {
        subject: "NVMS Rwanda — Password update required",
        text: [
            "Hello {{name}},",
            "",
            "For security, you must update your password before continuing.",
            "",
            "Link: {{link}}",
            "",
            "— NVMS Rwanda",
        ].join("\n"),
    };
}
export function renderTemplate(templateId, vars) {
    const t = getTemplate(templateId);
    return {
        subject: render(t.subject, vars),
        text: render(t.text, vars),
    };
}
