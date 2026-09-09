/**
 * Shared state shape for the clock in / clock out server actions.
 *
 * The tracker is button-only (no form fields), so there is no Zod schema
 * here — actions are invoked directly from the client tracker component
 * and return this state. Input trust boundary stays intact: the actions
 * take NO arguments and source organization_id + user_id exclusively
 * from the server-side session.
 */
export interface ClockActionState {
  status: "idle" | "success" | "error";
  error?: string | null;
}

export const initialClockState: ClockActionState = {
  status: "idle",
};
