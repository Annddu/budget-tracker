import { differenceInDays } from "date-fns";
import { z } from "zod";

export const OverviewQuerySchema = z
.object({
    from: z.coerce.date(),
    to: z.coerce.date(),
})
.refine((args) => {
    const { from, to } = args;
    const days = differenceInDays(to, from);

    const isValid = days >= 0 && days <= 365;
    return isValid;
})