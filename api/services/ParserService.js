// api/services/ParserService.js

var dateFormat = require('dateformat');

var securityQuestions = [
  'Mymother\'smaiden name',
  'My first pet\'sname',
  'My favourite book',
  'My favorite singer'
];

var messages = {
  menu: "1: Check Balance 2: Deposit/Withdraw 3: Send Money 4: Request Money 5: Lend/Borrow",
  register: 'Please sign up a user name (User name need to start with a letter)',
  sendMoney: 'Please enter contact OR select: 2, 3, 4, 5: List favorite/recent contacts',
  requestMoney: 'Please enter contact OR select: 2, 3, 4, 5: List favorite/recent contacts',
  securityQuestions: () => {
    let result = 'Please select the following questionsassecurity question: ';
    for (let i = 0; i < securityQuestions.length; i++) {
      result += `${ (i + 1) }: ${ securityQuestions[i] } `;
    }
    return result;
  },
  profile: (session) => {
    let result = 'You almost finished setting up your account.';
    result += `Account number `;
    result += `User Name: ${ session.userName } `;
    result += `SecurityQuestion: ${ securityQuestions[session.securityQuestion] } `;
    result += `Answer to SecurityQuestion: ${ session.answer } `;
    result += `Your birthdate: ${ session.strDate } `;
    result += 'Please confirmby replyingwith your PIN, or reply "DENY" to deny';
    return result;
  }
}

module.exports = {
  parse: function ({message, phoneNumber, session, user}, cb) {
    switch (message) {
      case 'menu': {
        result = messages.menu;
        init(session, 'menu');
        break;
      }

      case 'register': {
        result = messages.register;
        init(session, 'register');
        break;
      }

      case '1': {
        result = `Please confirm you want to check balance on ${ dateFormat(new Date(), 'dd/mm/yyyy') } by enteringyour PIN.`;
        init(session, 'checkBalance');
        break;
      }

      case '2': {
        init(session, 'deposit');
        result = 'Would you like to deposit or withdraw? 2.1 Deposit 2.2 Withdraw';
        break;
      }

      case '3': {
        result = messages.sendMoney;
        init(session, 'sendMoney');
        break;
      }

      case '4': {
        result = messages.requestMoney;
        init(session, 'requestMoney');
        break;
      }

      case '5': {
        result = 'Who would you like to lend to?';
        init(session, 'lendMoney');
        break;
      }

      case 'count': {
        const smsCount = session.counter || 0;

        result = 'Hello, thanks for the new message.';

        if (smsCount > 0) {
          result = 'Hello, thanks for message number ' + (smsCount + 1);
        }

        session.counter = smsCount + 1;

        break;
      }

      default: {

        switch (session.action) {
          case 'menu': {

            break;
          }

          case 'register': {
            switch (session.step) {
              case 0: {
                if (isLetter(message)) {
                  session.userName = message;
                  nextStep(session);
                  result = 'User name is valid. Please set up a password for your account.';
                } else {
                  result = checkAttemptCount(session) || 'User name is invalid. Please sign up a user name (User name need to start with a letter)'
                }
                break;
              }

              case 1: {
                session.password = message;
                nextStep(session);
                result = 'Password isqualified. Please enter your birth date.';
                break;
              }

              case 2: {
                session.date = message;
                result = messages.securityQuestions();
                nextStep(session);
                break;
              }

              case 3: {
                let n = parseInt(message.substr(1));
                if (n >= 1 && n <= 4) {
                  session.securityQuestion = n;
                  nextStep(session);
                  result = `You have chosen "${ securityQuestions[n - 1] }" asyour security question. Please replywith the answer or reply "0" to rechoose the security questions.`;
                } else {
                  result = checkAttemptCount(session) || `Please select security question ([1..${ securityQuestions.length }])`;
                }
                break;
              }

              case 4: {
                if (message.length >= 1 && message[0] === '0') {
                  --session.step;
                  session.attempt = 0;
                  result = messages.securityQuestions();
                } else {
                  session.answer = message;
                  session.phone = phoneNumber;
                  nextStep(session);
                  result = messages.profile(session);
                  break;
                }
              }

              case 5: {
                if (message.toLowerCase() === 'deny') {
                  init(session, 'menu');
                } else if (message === session.password) {
                  result = 'You have now set up your account. If youwant to keep authenticating your account pleasereply with "authentication" or you are your set.';
                  return User.create({
                    phone: session.phone,
                    userName: session.userName,
                    dateOfBirth: session.date,
                    password: session.password,
                    securityQuestion: session.securityQuestion,
                    answerToSecurityQuestion: session.answer
                  }).exec(function (err, user) {
                    if (err) {
                      console.error(err);
                      cb(err)
                    } else {
                      init(session, 'menu');
                      cb(null, result);
                    }
                  })
                } else {
                  result = checkAttemptCount(session) || 'PIN do not match. Please try again.'
                }
              }
            }
            break;
          }

          case 'checkBalance': {
            switch (session.step) {
              case 0: {
                return User.comparePassword(message, user, (err, valid) => {
                  if (err) {
                    cb(err);
                  } else {
                    if (valid) {
                      TokensService.balanceOf({address: user.identity}, (err, result) => {
                        cb(err, !err ? `${ dateFormat(new Date(), 'dd/mm/yyyy') } eNaira: ${ result }.` : null);
                      });
                    } else {
                      cb(null, checkAttemptCount(session) || 'Wrong PIN. Please try again.');
                    }
                  }
                })
              }
            }
            break;
          }

          case 'deposit': {
            switch (session.step) {
              case 0: {
                if (message === '2.2') {
                  nextStep(session);
                  result = checkAttemptCount(session) || 'Howmuch would you like to withdraw?';
                }
                break;
              }
              case 1: {
                amount = message.substr(1);
                if (message[0] === '$' && parseInt(amount).toString() === amount) {
                  session.amount = parseInt(amount);
                  nextStep(session);
                  result = `Please enter agent number ORselect: 2: NearbyAgents 3, 4, 5, 6: recent agents`;
                } else {
                  result = checkAttemptCount(session) || 'Wrong amount format. Please try again (example $100).';
                }
                break;
              }
              case 2: {
                return User.findOne({ phone: message }, (err, user) => {
                  if (err) {
                    cb(err);
                  }
                  if (user) {
                    session.contact = message;
                    nextStep(session);
                    cb(null, `User ${ phoneNumber } wants to withdraw $${ session.amount } from , do you accept? Accept OR Reject`);
                  } else {
                    cb(null, checkAttemptCount(session) || 'Contact not found. Please try again.');
                  }
                });
              }
              case 2: {
                if (message.toLowerCase().indexOf('accept') >= 0) {
                  nextStep(session);
                  result = 'Please enter your commission as total amount or percentage. Add "%" if youwant to set aspercentage.'
                } else if (message.toLowerCase().indexOf('reject') >= 0) {
                  init(session, 'menu');
                  result = messages.menu;
                } else {
                  checkAttemptCount(session);
                  result = 'Please enter Accept OR Reject!';
                }
                break;
              }
              case 3: {
                if (message.indexOf('%') > 0) {
                  session.percentage = parseInt(message);
                  result = `Please confirm ${ phoneNumber } withdraws $${ session.amount } from ${ session.contact } for $1 commission.`
                  nextStep(session);
                }
                break;
              }
              case 4: {
                return User.comparePassword(message, user, (err, valid) => {
                  if (err) {
                    cb(err);
                  } else {
                    if (valid) {
                      result = `Withdrew $${ session.amount } from ${ phoneNumber } for $1 commission on ${ dateFormat(new Date(), 'dd/mm/yyyy H:M') }.`
                      cb(null, result);
                    } else {
                      cb(null, checkAttemptCount(session) || 'Wrong PIN. Please try again.');
                    }
                  }
                })
              }
              default: {

              }
            }
            break;
          }

          case 'requestMoney': {

          }

          case 'sendMoney': {
            switch (session.step) {
              case 0: {
                return User.findOne({ phone: message }, (err, user) => {
                  if (err) {
                    cb(err);
                  }
                  if (user) {
                    session.contact = message;
                    nextStep(session);
                    cb(null, 'Please enter amount.');
                  } else {
                    cb(null, checkAttemptCount(session) || 'Contact not found. Please try again.');
                  }
                });
              }

              case 1: {
                amount = message.substr(1);
                if (message[0] === '$' && parseInt(amount).toString() === amount) {
                  session.amount = parseInt(amount);
                  nextStep(session);
                  result = `Please confirm you want to request $${ amount } from ${ phoneNumber } by enteringyour PIN.`;
                } else {
                  result = checkAttemptCount(session) || 'Wrong amount format. Please try again (example $100).';
                }
                break;
              }

              case 2: {
                return User.comparePassword(message, user, (err, valid) => {
                  if (err) {
                    cb(err);
                  } else {
                    if (valid) {
                      if(session.action === 'sendMoney') {
                        result = `Transaction receipt: Sent $${ session.amount } `;
                      } else {
                        result = `Request notification hasbeen sent `
                      }
                      cb(null, result + `to ${ session.contact } on ${ dateFormat(new Date(), 'dd/mm/yyyy H:M') }.`);
                    } else {
                      cb(null, checkAttemptCount(session) || 'Wrong PIN. Please try again.');
                    }
                  }
                })
              }
            }
            break;
          }

          case 'lendMoney': {
            switch (session.step) {
              case 0: {
                return User.findOne({ phone: message }, (err, user) => {
                  if (err) {
                    cb(err);
                  }
                  if (user) {
                    session.contact = message;
                    nextStep(session);
                    cb(null, 'How much would you like to lend?.');
                  } else {
                    cb(null, checkAttemptCount(session) || 'Contact not found. Please try again.');
                  }
                });
              }

              case 1: {
                amount = message.substr(1);
                if (message[0] === '$' && parseInt(amount).toString() === amount) {
                  session.amount = parseInt(amount);
                  nextStep(session);
                  result = `Please enter lending period in days.`;
                } else {
                  result = checkAttemptCount(session) || 'Wrong amount format. Please try again (example $100).';
                }
                break;
              }

              case 2: {
                var days = parseInt(message)
                if (days) {
                  session.days = days;
                  nextStep(session);
                  result = `Please enter your total interest required or annual interest rate. e.g. 1.5 or 3%.`;
                } else {
                  result = checkAttemptCount(session) || 'Wrong days format. Please try again (example 180).';
                }
                break;
              }

              case 3: {
                var rate = parseInt(rate)
                if ([1.5, 3].indexOf(rate) >= 0) {
                  session.rate = rate;
                  nextStep(session);
                  result = `Please confirmyou want to lend $${ session.amount } from ${ dateFormat(new Date(), 'dd/mm/yyyy') } to ${ dateFormat(new Date(new Date().setDate(new Date().getDate() + session.days)), 'dd/mm/yyyy') } at ${ session.rate }% interest for a total of $3, confirmby replying with your PIN, or reply "DENY" to cancel.`;
                } else {
                  result = checkAttemptCount(session) || 'Please try again. Please enter your total interest required or annual interest rate. e.g. 1.5 or 3%';
                }
                break;
              }

              case 4: {
                if (message.toLowerCase() === 'deny') {
                  init(session, 'menu');
                  result = messages.menu;
                } else {
                  return User.comparePassword(message, user, (err, valid) => {
                    if (err) {
                      cb(err);
                    } else {
                      if (valid) {
                        result = `Lend $${ session.amount } from ${ dateFormat(new Date(), 'dd/mm/yyyy') } to ${ dateFormat(new Date(new Date().setDate(new Date().getDate() + session.days)), 'dd/mm/yyyy') } from ${ phoneNumber } for ${ session.rate }% interest on ${ dateFormat(new Date(), 'dd/mm/yyyy H:M') }.`
                        cb(null, result);
                      } else {
                        cb(null, checkAttemptCount(session) || 'Wrong PIN. Please try again.');
                      }
                    }
                  })
                }
              }

              default: {
                init(session, 'menu');
                result = messages.menu;
              }
            }
            break;
          }

          default: {
            result = 'Error!'
          }
        }
      }
    }
    return cb(null, result);
  },

  init,
  isLetter,
  isNumber,
  nextStep,
  checkAttemptCount
};

function isNumber (str) {
  var arr = str.split('-');

  if (arr.length !== 3) {
    return false;
  }

  for (var i = 0; i < arr.length; i++) {
    if (parseInt(arr[i]).toString() !== arr[i]) {
      return false;
    }
  }

  return true;
}

function init (session, action) {
  if (session) {
    session.action = action;
    session.step = 0;
    session.attempt = 0;
  }
}

function isLetter (str) {
  return str[0].toLowerCase() != str[0].toUpperCase();
}

function nextStep (session) {
  if (session) {
    ++session.step;
    session.attempt = 0;
  }
}

function checkAttemptCount (session){
  session.attempt += 1;
  if (session.attempt >= 3) {
    init(session, 'menu');
    return 'Ended the number of attempts, please try again.';
  }
}
