/** Mirrors frontend rules: verified account + trusted KYC + profile completeness. */
export function volunteerEligibleToApply(user) {
    if (user.role !== "volunteer")
        return false;
    if (user.govStatus !== "active")
        return false;
    if (user.verificationStatus !== "verified")
        return false;
    if (user.profileTrustStatus !== "verified")
        return false;
    if (!user.phone?.trim())
        return false;
    if (!user.skills?.length && !user.trustSkillsSummary?.trim())
        return false;
    const avail = user.volunteerAvailability?.trim();
    if (!avail)
        return false;
    if (!user.profession?.trim() || !user.educationLevel?.trim())
        return false;
    return true;
}
export function eligibilityReason(user) {
    if (!volunteerEligibleToApply(user)) {
        if (user.verificationStatus !== "verified")
            return "Wait for district approval of your registration.";
        if (user.profileTrustStatus !== "verified")
            return "Complete Identity & trust (KYC) and coordinator approval.";
        if (!user.phone?.trim())
            return "Add a phone number on your profile.";
        if (!user.skills?.length && !user.trustSkillsSummary?.trim())
            return "Add skills on your profile.";
        if (!user.volunteerAvailability?.trim())
            return "Set your availability.";
        if (!user.profession?.trim() || !user.educationLevel?.trim())
            return "Add profession and education.";
        return "Not eligible to apply.";
    }
    return null;
}
