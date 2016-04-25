var _ = require('lodash'),
    loopback = require('loopback'),
    Promise = require('bluebird');

/**
 * Mixin that automatically adds a filter on access by organisation id
 * @param Model
 * @param options
 */
module.exports = function(Model, options) {

    Model.observe('access', function(ctx, next) {

        var appContext = loopback.getCurrentContext(),
            orgId = appContext.get('organisationId');

        orgId = 1;

        if(!orgId) {
            //We need to kill the app as the user must be completely unauthenticated
            next(new Error('Not authenticated'));
        }

        ctx.query.where = ctx.query.where || {};

        //Add the organisation filter to the where
        ctx.query.where.organisation_id = orgId;

        //Add the itemId to the context so that it can be read later in the request chain
        if(ctx.query.where.id) {
            appContext.set('itemId', ctx.query.where.id);
        }

        next();
    });

};
