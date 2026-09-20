/** An actionable message that can safely be shown in the Arabic interface. */
export class UserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserError';
  }
}
