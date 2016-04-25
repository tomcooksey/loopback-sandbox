module.exports = function(app) {

    app.dataSources.mysql.autoupdate('MenuItem', function(err) {

    });

    app.dataSources.mysql.autoupdate('ItemsToItems', function(err) {

    });

    app.dataSources.mysql.autoupdate('Advert', function(err) {

    });

    app.dataSources.mysql.autoupdate('AdvertI18N', function(err) {

    });

    app.dataSources.mysql.autoupdate('Language', function(err) {

    });
};