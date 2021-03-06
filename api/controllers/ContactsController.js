/**
 * ContactsController
 *
 * @description :: Server-side logic for managing contacts
 * @help        :: See http://sailsjs.org/#!/documentation/concepts/Controllers
 */

/* global User */

module.exports = {

  /**
   * `ContactsController.index()`
   */
  index: function (req, res) {
    const {
      search = '',
      limit = 30,
      skip = 0,
      sort = 'userName'
    } = req.allParams();

    let where = {
      or: [
        {phone: {contains: search}},
        {userName: {contains: search}},
        {email: {contains: search}},
        {legalName: {contains: search}}
      ]
    };

    if (req.user) {
      where.id = {'!': req.user.id};
    }

    Promise.all([
      User.find({ where, limit, skip, sort }),
      User.count(where)
    ])
    .then(([data, total]) => res.json({data, total}))
    .catch(err => res.negotiate(err));
  }
};
