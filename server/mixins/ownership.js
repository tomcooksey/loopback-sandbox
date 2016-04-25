var _ = require('lodash'),
    loopback = require('loopback'),
    Promise = require('bluebird');

/**
 * Mixin that applies the organisation id set in the session, this means
 * ownership is automatically applied rather than having to be manually selected
 * @param Model
 * @param options
 */
module.exports = function(Model, options) {

    Model.observe('before save', function(ctx, next) {

        var requestContext = loopback.getCurrentContext(),
            orgId = requestContext.get('organisationId');

        orgId = 1;

        if(!requestContext.get('itemId')) {
            ctx.instance.organisation_id = orgId;
        }else if(requestContext.get('itemId') && ctx.isNewInstance) {
            //If an ID was sent but isNewInstance has been set to true it means they
            //are trying to update an item they don't have access to (wrong organisation)
            //so we need to kill the operation by passing an error through to next();
            next(new Error('No matching entity'));
        }

        next();



    });

};