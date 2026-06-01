import { Mail } from '../model/mail';

export interface IMailRepository {
  persist(mail: Mail): Promise<Mail>;
}

export const IMailRepository = Symbol('IMailRepository');
