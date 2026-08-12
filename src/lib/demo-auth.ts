export const DEMO_AUTHOR = {
  id: "user_lin",
  name: "林屿",
  email: "lin@example.com",
};

export const DEMO_READER = {
  id: "user_reader",
  name: "白页读者",
  email: "reader@example.com",
};

export const DEMO_OTP = "246810";

export function demoAuthHeaders(userId: string) {
  return { "x-demo-user-id": userId };
}
