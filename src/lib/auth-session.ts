// proxy 验签后写入请求头的用户信息，供 RSC 复用；不可直接用客户端传来的同名头。
export const SESSION_USER_ID_HEADER = "x-nook-uid";
export const SESSION_USER_EMAIL_HEADER = "x-nook-uem";

export type SessionUser = {
  id: string;
  email: string | null;
};
