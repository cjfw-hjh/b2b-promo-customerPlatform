const nodemailer = require('nodemailer');
const notificationService = require('./notificationService');

describe('sendNotification', () => {
  const ORIGINAL_ENV = process.env;

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    jest.restoreAllMocks();
  });

  test('SMTP_HOST가 없으면 console.log로 발송을 대체한다(PRD 7번 리스크 상태)', async () => {
    delete process.env.SMTP_HOST;
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    await notificationService.sendNotification({
      to: 'a@test.com',
      subject: '제목',
      text: '내용',
    });

    expect(logSpy).toHaveBeenCalledTimes(1);
    const logged = logSpy.mock.calls[0].join(' ');
    expect(logged).toContain('a@test.com');
    expect(logged).toContain('제목');
    expect(logged).toContain('내용');
  });

  test('SMTP_HOST가 있으면 nodemailer transporter로 실제 발송을 시도한다', async () => {
    process.env.SMTP_HOST = 'smtp.test.com';
    const sendMail = jest.fn().mockResolvedValue();
    jest.spyOn(nodemailer, 'createTransport').mockReturnValue({ sendMail });

    await notificationService.sendNotification({
      to: 'a@test.com',
      subject: '제목',
      text: '내용',
    });

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'a@test.com', subject: '제목', text: '내용' })
    );
  });

  test('nodemailer의 sendMail이 reject해도 sendNotification은 에러 없이 끝난다', async () => {
    process.env.SMTP_HOST = 'smtp.test.com';
    jest.spyOn(nodemailer, 'createTransport').mockReturnValue({
      sendMail: jest.fn().mockRejectedValue(new Error('SMTP 다운')),
    });
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      notificationService.sendNotification({ to: 'a@test.com', subject: '제목', text: '내용' })
    ).resolves.toBeUndefined();
    expect(errSpy).toHaveBeenCalled();
  });

  test('createTransport 자체가 동기적으로 throw해도 sendNotification은 에러 없이 끝난다', async () => {
    process.env.SMTP_HOST = 'smtp.test.com';
    jest.spyOn(nodemailer, 'createTransport').mockImplementation(() => {
      throw new Error('설정 오류');
    });
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      notificationService.sendNotification({ to: 'a@test.com', subject: '제목', text: '내용' })
    ).resolves.toBeUndefined();
    expect(errSpy).toHaveBeenCalled();
  });
});
